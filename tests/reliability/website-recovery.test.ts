import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test from 'node:test';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {authorizedCron} from '../../src/lib/services/cron-auth';
import {recoverWebsiteLeadNotifications} from '../../src/lib/services/website-notification-recovery';
import {saveWebsiteLead} from '../../src/lib/services/website-leads';
import {deliverNotification} from '../../src/lib/agent/notifications';

test('Cron rejects missing, incorrect and same-length non-ASCII credentials without throwing', () => {
  const request = (value?: string) => new Request('https://test.invalid', {headers: value ? {authorization: value} : {}});
  assert.equal(authorizedCron(request(), 'secret'), false);
  assert.equal(authorizedCron(request('Bearer secret'), ''), false);
  assert.equal(authorizedCron(request('Bearer secrét'), 'secret'), false);
  assert.equal(authorizedCron(request('bearer secret'), 'secret'), false);
  assert.equal(authorizedCron(request('Bearer secret'), 'secret'), true);
});

test('Recovery leaves unstarted work durable when its time budget expires', async () => {
  let now = 0, calls = 0;
  const db = {$queryRaw:async()=>[{id:'first'},{id:'second'},{id:'third'}],notification: {findMany: async () => [{deliveryState: 'PENDING'}]}} as unknown as PrismaClient;
  const result = await recoverWebsiteLeadNotifications(db, async () => {calls++; now = 30_001;}, () => now);
  assert.equal(calls, 1);
  assert.deepEqual(result, {selected: 3, processed: 1, deferred: 2, errors: 0, sent: 0, pending: 1, failed: 0, unknown: 0, durationMs: 30_001});
});

const url = process.env.PRO_RECOVERY_TEST_DATABASE_URL;
test('Isolated PostgreSQL: committed leads survive Telegram outage and concurrent recovery', {skip: !url}, async t => {
  const target = new URL(url!);
  assert.ok(['localhost', '127.0.0.1'].includes(target.hostname));
  assert.ok(/^\/lumaclean_pro_recovery_test(?:_v2)?$/.test(target.pathname));
  const db = new PrismaClient({adapter: new PrismaPg({connectionString: url!})});
  const ids: string[] = [];
  const unrelatedKey = `pro-other:${randomUUID()}`;
  const recipientId=randomUUID();
  const payload = () => ({submissionId: randomUUID(), phone: '0641234567', locale: 'ru', consent: true, requestKind: 'CONTACT_REQUEST'});
  const notify = async (id: string) => db.notification.findUniqueOrThrow({where: {eventKey: `website-lead:${id}:telegram`}});
  try {
    await t.test('concurrent repeated submissions create one lead and one outbox event', async () => {
      const input = payload();
      const saved = await Promise.all(Array.from({length: 12}, () => saveWebsiteLead(db, input)));
      ids.push(saved[0].id);
      assert.equal(new Set(saved.map(row => row.id)).size, 1);
      assert.equal(saved.filter(row => row.created).length, 1);
      assert.equal(await db.notification.count({where: {eventKey: `website-lead:${saved[0].id}:telegram`}}), 1);
      await assert.rejects(saveWebsiteLead(db, {...input, phone: '0647654321'}), /Submission ID/);
    });
    await t.test('Telegram rate limit retains the lead; recovery respects backoff then delivers once', async () => {
      const lead = await saveWebsiteLead(db, payload()); ids.push(lead.id);
      const event = await notify(lead.id);
      await assert.rejects(deliverNotification(db, event.id, async () => ({status: 'FAILED', errorCode: 'TELEGRAM_RATE_LIMIT'})), /NOTIFICATION_RETRY/);
      assert.equal(await db.lead.count({where: {id: lead.id}}), 1);
      let sends = 0;
      const delivery = async (client: PrismaClient, id: string) => deliverNotification(client, id, async () => {sends++; return {status: 'DELIVERED', externalMessageId: 'synthetic'};});
      await recoverWebsiteLeadNotifications(db, delivery);
      assert.equal((await notify(lead.id)).deliveryState, 'PENDING');
      await db.notification.update({where: {id: event.id}, data: {nextAttemptAt: new Date(0)}});
      sends = 0;
      await Promise.all([recoverWebsiteLeadNotifications(db, delivery), recoverWebsiteLeadNotifications(db, delivery)]);
      assert.equal(sends, 1);
      assert.equal((await notify(lead.id)).deliveryState, 'DELIVERED');
      assert.equal((await db.lead.findUniqueOrThrow({where: {id: lead.id}})).telegramStatus, 'SENT');
    });
    await t.test('expired sending lease becomes UNKNOWN, terminal and future events are excluded', async () => {
      for (const state of ['SENDING', 'UNKNOWN', 'FAILED', 'DELIVERED', 'PENDING']) {
        const lead = await saveWebsiteLead(db, payload()); ids.push(lead.id);
        await db.notification.update({where: {id: (await notify(lead.id)).id}, data: {
          deliveryState: state, leaseUntil: state === 'SENDING' ? new Date(0) : null,
          scheduledAt: state === 'PENDING' ? new Date(Date.now() + 86_400_000) : new Date(),
        }});
      }
      const summary = await recoverWebsiteLeadNotifications(db, (client, id) => deliverNotification(client, id, async () => assert.fail('No ambiguous/terminal/future resend')));
      assert.equal(summary.unknown, 1);
      assert.equal(summary.processed, 1);
      assert.equal((await recoverWebsiteLeadNotifications(db, async () => assert.fail('No work'))).selected, 0);
    });
    await t.test('batches are bounded and do not touch other notification kinds', async () => {
      await db.user.create({data:{id:recipientId,email:`pro-recovery-${recipientId}@example.test`,name:'Synthetic notification recipient',role:'ADMIN'}});
      const other = await db.notification.create({data: {eventKey: unrelatedKey, userId:recipientId, kind: 'HANDOFF_TELEGRAM', audience: 'ADMIN', channel: 'TELEGRAM', text: 'Synthetic unrelated event', scheduledAt: new Date(0), deliveryState: 'PENDING'}});
      // Sofija uses the shared WEBSITE_LEAD kind but its Lead channel is OTHER.
      const voice=await saveWebsiteLead(db,payload());ids.push(voice.id);
      await db.lead.update({where:{id:voice.id},data:{channel:'OTHER'}});
      await db.notification.update({where:{id:(await notify(voice.id)).id},data:{scheduledAt:new Date(0)}});
      for (let i = 0; i < 12; i++) {const lead = await saveWebsiteLead(db, payload()); ids.push(lead.id);}
      const result = await recoverWebsiteLeadNotifications(db, (client, id) => deliverNotification(client, id, async () => ({status: 'DELIVERED'})));
      assert.equal(result.selected, 10); assert.equal(result.sent, 10);
      assert.equal((await recoverWebsiteLeadNotifications(db, (client, id) => deliverNotification(client, id, async () => ({status: 'DELIVERED'})))).sent, 2);
      assert.equal((await db.notification.findUniqueOrThrow({where: {id: other.id}})).deliveryState, 'PENDING');
      assert.equal((await notify(voice.id)).deliveryState,'PENDING','Voice WEBSITE_LEAD must remain outside website recovery');
    });
  } finally {
    // Only this test's synthetic records in a dedicated localhost database.
    await db.notification.deleteMany({where: {eventKey: {in: ids.map(id => `website-lead:${id}:telegram`)}}});
    await db.notification.deleteMany({where: {eventKey: unrelatedKey}});
    await db.lead.deleteMany({where: {id: {in: ids}}});
    await db.user.deleteMany({where:{id:recipientId}});
    await db.$disconnect();
  }
});
