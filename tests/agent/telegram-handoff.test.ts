import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '../../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { pgConnectionString } from '../../src/lib/database/connection';
import { handoffNotification, deliverNotification } from '../../src/lib/agent/notifications';
import { runInboxCommand } from '../../src/lib/agent/inbox';
import { claimTelegramHandoff, deliverHandoffNotification, handoffCallbackData, handoffReminderDelayMs, handoffTelegramConfigured, sendHandoffTelegram, verifyHandoffWebhook } from '../../src/lib/agent/telegram-handoff';

const keys = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'TELEGRAM_HANDOFF_WEBHOOK_SECRET', 'VERCEL'] as const;
async function configured(run: () => Promise<void>) {
  const baseline = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  Object.assign(process.env, { TELEGRAM_BOT_TOKEN: 'synthetic-internal-bot-token', TELEGRAM_CHAT_ID: '123456789', TELEGRAM_HANDOFF_WEBHOOK_SECRET: 'synthetic-webhook-secret-for-unit-tests-only', VERCEL: '0' });
  try { await run(); } finally { for (const k of keys) if (baseline[k] === undefined) delete process.env[k]; else process.env[k] = baseline[k]; }
}
const id = 'c' + 'a'.repeat(24);
test('internal bot secret, bounded signed callback and exact button; unrelated customer channel stays unused', () => configured(async () => {
  assert(handoffTelegramConfigured());
  assert(verifyHandoffWebhook(process.env.TELEGRAM_HANDOFF_WEBHOOK_SECRET!));
  assert(!verifyHandoffWebhook(null)); assert(!verifyHandoffWebhook('wrong')); assert(!verifyHandoffWebhook('я'.repeat(42)));
  assert(Buffer.byteLength(handoffCallbackData(id)) <= 64);
  let calls = 0;
  const result = await sendHandoffTelegram('AI передал клиента человеку', id, async (url, init) => {
    calls++; assert(String(url).includes('synthetic-internal-bot-token'));
    const body = JSON.parse(String(init?.body));
    assert.equal(body.chat_id, '123456789');
    assert.equal(body.reply_markup.inline_keyboard[0][0].text, 'Забрал клиента');
    assert.equal(body.reply_markup.inline_keyboard[0][0].callback_data, handoffCallbackData(id));
    assert.equal(body.protect_content, true);
    return Response.json({ ok: true, result: { message_id: 41 } });
  });
  assert.equal(calls, 1); assert.equal(result.status, 'DELIVERED'); assert.equal(result.externalMessageId, '41');
}));
test('definite Telegram rate limit retries; ambiguous sends never falsely report delivered', () => configured(async () => {
  assert.equal((await sendHandoffTelegram('x', id, async () => new Response('', { status: 429 }))).errorCode, 'TELEGRAM_RATE_LIMIT');
  assert.equal((await sendHandoffTelegram('x', id, async () => new Response('', { status: 503 }))).status, 'UNKNOWN');
  assert.equal((await sendHandoffTelegram('x', id, async () => { throw Error('network'); })).status, 'UNKNOWN');
  assert.equal((await sendHandoffTelegram('x', id, async () => Response.json({ ok: false }, { status: 400 }))).status, 'FAILED');
  delete process.env.TELEGRAM_HANDOFF_WEBHOOK_SECRET;
  assert(!handoffTelegramConfigured());
  assert.equal((await sendHandoffTelegram('x', id, async () => assert.fail('no send'))).status, 'FAILED');
}));

const url = process.env.HANDOFF_TEST_DATABASE_URL;
test('durable handoff delivery, two-minute reminder, claim and concurrency', { skip: !url }, t => configured(async () => {
  assert(new URL(url!).hostname.startsWith('ep-wispy-river-b8xwqy9q'), 'Only the isolated Preview database is permitted');
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConnectionString(url!), max: 5 }) });
  const created: string[] = [], namespace = 'handoff-test:' + randomUUID();
  const baselineOrders = await db.order.count();
  const baselineMode = (await db.businessSettings.findUniqueOrThrow({ where: { id: 'default' } })).aiAgentMode;
  const owner = await db.user.findFirstOrThrow({ where: { role: 'ADMIN', active: true }, orderBy: { createdAt: 'asc' } });
  async function fixture() {
    const c = await db.conversation.create({ data: { channel: 'WEBSITE', externalThreadId: namespace + ':' + created.length, control: 'HUMAN_CONTROL', stage: 'HANDOFF', needsAttention: true } }); created.push(c.id);
    const h = await db.humanHandoff.create({ data: { conversationId: c.id, reason: 'CLIENT_REQUEST' } });
    await db.$transaction(tx => handoffNotification(tx, c.id, h.id, h.reason));
    const n = await db.notification.findUniqueOrThrow({ where: { eventKey: `handoff:${h.id}:telegram` } });
    return { c, h, n };
  }
  function callback(handoffId: string, overrides: { user?: number; chat?: number; type?: 'private' | 'group' } = {}) {
    return { update_id: 1, callback_query: { id: 'synthetic-query', data: handoffCallbackData(handoffId), from: { id: overrides.user ?? 123456789, is_bot: false }, message: { message_id: 41, chat: { id: overrides.chat ?? 123456789, type: overrides.type ?? 'private' } } } };
  }
  const delivered = async () => ({ status: 'DELIVERED' as const, externalMessageId: '41' });
  try {
    await t.test('handoff is idempotent and creates internal + external records', async () => {
      const { c, h } = await fixture();
      await db.$transaction(tx => handoffNotification(tx, c.id, h.id, h.reason));
      assert.equal(await db.notification.count({ where: { conversationId: c.id } }), 2);
      assert.equal(await db.notification.count({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } }), 0);
    });
    await t.test('successful first send schedules one reminder 120 seconds after delivery', async () => {
      const { c, n } = await fixture(), before = Date.now(); let sends = 0;
      await Promise.all([0,1].map(()=>deliverNotification(db,n.id,async()=>{sends++;return delivered();}).catch(e=>assert.match(String(e),/NOTIFICATION_LEASE_ACTIVE/))));
      const reminder = await db.notification.findFirstOrThrow({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } });
      assert.equal(sends, 1); assert(reminder.scheduledAt.getTime() >= before + handoffReminderDelayMs);
      assert(reminder.scheduledAt.getTime() <= Date.now() + handoffReminderDelayMs);
      await assert.rejects(deliverNotification(db, reminder.id, async () => assert.fail('not yet')), /NOTIFICATION_NOT_DUE/);
      await deliverNotification(db, n.id, async () => assert.fail('never resend'));
      assert.equal(await db.notification.count({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } }), 1);
    });
    await t.test('exactly one reminder, with no third notification', async () => {
      const { c, n } = await fixture(); await deliverNotification(db, n.id, delivered);
      const reminder = await db.notification.findFirstOrThrow({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } });
      await db.notification.update({ where: { id: reminder.id }, data: { scheduledAt: new Date(0) } });
      let sends = 0; await deliverNotification(db, reminder.id, async () => { sends++; return delivered(); }); await deliverNotification(db, reminder.id, async () => assert.fail('no duplicate'));
      assert.equal(sends, 1); assert.equal(await db.notification.count({ where: { conversationId: c.id } }), 3);
    });
    await t.test('button claims client, cancels reminder, increments control revision; repeat is harmless', async () => {
      const { c, h, n } = await fixture(); await deliverNotification(db, n.id, delivered);
      assert.equal(await claimTelegramHandoff(db, callback(h.id)), 'CLAIMED');
      const current = await db.conversation.findUniqueOrThrow({ where: { id: c.id } });
      assert.equal(current.control, 'HUMAN_CONTROL'); assert.equal(current.ownerId, owner.id); assert.equal(current.needsAttention, false); assert.equal(current.revision, c.revision + 1);
      assert((await db.humanHandoff.findUniqueOrThrow({ where: { id: h.id } })).resolvedAt);
      const reminder = await db.notification.findFirstOrThrow({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } }); assert.equal(reminder.deliveryState, 'CANCELLED');
      await deliverNotification(db, reminder.id, async () => assert.fail('cancelled'));
      assert.equal(await claimTelegramHandoff(db, callback(h.id)), 'ALREADY_CLAIMED');
      assert.equal(await db.auditLog.count({ where: { action: 'TELEGRAM_HANDOFF_CLAIMED', entityId: h.id } }), 1);
    });
    await t.test('Inbox takeover and close cancel reminder without Telegram click', async () => {
      for (const action of ['takeover', 'close'] as const) {
        const { c, n } = await fixture(); await deliverNotification(db, n.id, delivered);
        await runInboxCommand(db, owner.id, { action, id: c.id });
        assert.equal(await db.notification.count({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER', deliveryState: 'PENDING' } }), 0);
        assert.equal(await db.humanHandoff.count({ where: { conversationId: c.id, resolvedAt: null } }), 0);
      }
    });
    await t.test('foreign chat, wrong private sender and tampered signed button cannot claim', async () => {
      const { c, h } = await fixture();
      await assert.rejects(claimTelegramHandoff(db, callback(h.id, { chat: 987654321 })), /HANDOFF_FORBIDDEN/);
      await assert.rejects(claimTelegramHandoff(db, callback(h.id, { user: 987654321 })), /HANDOFF_FORBIDDEN/);
      const bad = callback(h.id); bad.callback_query.data = bad.callback_query.data.slice(0, -1) + '!';
      await assert.rejects(claimTelegramHandoff(db, bad), /HANDOFF_FORBIDDEN/);
      assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: c.id } })).ownerId, null);
    });
    await t.test('group membership verified; nonmember rejected; trusted internal member can acknowledge', async () => {
      process.env.TELEGRAM_CHAT_ID = '-123456789';
      try {
        const { c, h } = await fixture();
        await assert.rejects(claimTelegramHandoff(db, callback(h.id, { chat: -123456789, type: 'group' }), async () => Response.json({ ok: true, result: { status: 'left' } })), /HANDOFF_FORBIDDEN/);
        assert.equal(await claimTelegramHandoff(db, callback(h.id, { chat: -123456789, type: 'group' }), async (url, init) => { assert(String(url).endsWith('/getChatMember')); assert.equal(JSON.parse(String(init?.body)).chat_id, '-123456789'); return Response.json({ ok: true, result: { status: 'member' } }); }), 'CLAIMED');
        assert.equal((await db.conversation.findUniqueOrThrow({ where: { id: c.id } })).ownerId, owner.id);
      } finally { process.env.TELEGRAM_CHAT_ID = '123456789'; }
    });
    await t.test('concurrent claims produce one winner and one audit record', async () => {
      const { h } = await fixture(); const results = await Promise.all([claimTelegramHandoff(db, callback(h.id)), claimTelegramHandoff(db, callback(h.id))]);
      assert.deepEqual(results.sort(), ['ALREADY_CLAIMED', 'CLAIMED']);
      assert.equal(await db.auditLog.count({ where: { action: 'TELEGRAM_HANDOFF_CLAIMED', entityId: h.id } }), 1);
    });
    await t.test('claim wins before an already-leased reminder: side effect suppressed', async () => {
      const { c, h, n } = await fixture(); await deliverNotification(db, n.id, delivered);
      const reminder = await db.notification.findFirstOrThrow({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } });
      const leaseKey=randomUUID();
      await db.notification.update({ where: { id: reminder.id }, data: { scheduledAt: new Date(0),deliveryState:'SENDING',leaseKey,leaseUntil:new Date(Date.now()+60_000) } });
      await claimTelegramHandoff(db, callback(h.id));
      await deliverHandoffNotification(db, reminder.id,leaseKey, async () => assert.fail('no post-claim send'));
      assert.equal((await db.notification.findUniqueOrThrow({ where: { id: reminder.id } })).deliveryState, 'CANCELLED');
    });
    await t.test('rate limits retry first send without premature reminder; UNKNOWN not retried', async () => {
      const { c, n } = await fixture();
      await assert.rejects(deliverNotification(db, n.id, async () => ({ status: 'FAILED', errorCode: 'TELEGRAM_RATE_LIMIT' })), /NOTIFICATION_RETRY/);
      assert.equal(await db.notification.count({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } }), 0);
      await db.notification.update({ where: { id: n.id }, data: { nextAttemptAt: new Date(0) } });
      await deliverNotification(db, n.id, async () => ({ status: 'UNKNOWN', errorCode: 'DELIVERY_OUTCOME_UNKNOWN' }));
      await deliverNotification(db, n.id, async () => assert.fail('never resend ambiguous'));
      assert.equal(await db.notification.count({ where: { conversationId: c.id, kind: 'HANDOFF_REMINDER' } }), 1);
    });
    assert.equal(await db.order.count(), baselineOrders);
    assert.equal((await db.businessSettings.findUniqueOrThrow({ where: { id: 'default' } })).aiAgentMode, baselineMode);
  } finally {
    await db.notification.deleteMany({ where: { conversationId: { in: created } } });
    await db.humanHandoff.deleteMany({ where: { conversationId: { in: created } } });
    await db.conversation.deleteMany({ where: { id: { in: created } } });
    await db.$disconnect();
  }
}));
