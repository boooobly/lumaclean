import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { Prisma, type PrismaClient } from '@/generated/prisma/client';
import { schedulingLock } from '@/lib/services/scheduling-commands';
import { writeAudit } from '@/lib/services/audit';
import { AgentError } from './contracts';
import type { DeliveryResult } from './channels';

type Tx = Prisma.TransactionClient;
export const handoffReminderDelayMs = 120_000;
export const handoffKinds = ['HANDOFF_TELEGRAM', 'HANDOFF_REMINDER'];
const payloadSchema = z.object({ handoffId: z.string().regex(/^[a-z0-9]{20,32}$/), reason: z.string(), telegramMessageId: z.string().optional() });
export const handoffCallbackSchema = z.object({
  update_id: z.number().int().nonnegative(),
  callback_query: z.object({
    id: z.string().min(1).max(256), data: z.string().max(64),
    from: z.object({ id: z.number().int().positive().safe(), is_bot: z.literal(false) }),
    message: z.object({ message_id: z.number().int().positive(), chat: z.object({ id: z.number().int().safe(), type: z.enum(['private', 'group', 'supergroup']) }) }),
  }).optional(),
});
export function handoffTelegramConfigured() {
  return !!process.env.TELEGRAM_BOT_TOKEN && /^-?[1-9]\d{0,15}$/.test(process.env.TELEGRAM_CHAT_ID ?? '') && /^[A-Za-z0-9_-]{32,256}$/.test(process.env.TELEGRAM_HANDOFF_WEBHOOK_SECRET ?? '');
}
export function verifyHandoffWebhook(actual: string | null) {
  const expected = process.env.TELEGRAM_HANDOFF_WEBHOOK_SECRET;
  return handoffTelegramConfigured() && !!actual && !!expected && Buffer.byteLength(actual) === Buffer.byteLength(expected) && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}
export function handoffCallbackData(id: string) {
  if (!/^[a-z0-9]{20,32}$/.test(id) || !process.env.TELEGRAM_HANDOFF_WEBHOOK_SECRET) throw new AgentError('INVALID_HANDOFF');
  const mac = createHmac('sha256', process.env.TELEGRAM_HANDOFF_WEBHOOK_SECRET).update('handoff:' + id).digest('base64url').slice(0, 16);
  return `lc:${id}:${mac}`;
}
function callbackHandoffId(data: string) {
  const match = /^lc:([a-z0-9]{20,32}):[A-Za-z0-9_-]{16}$/.exec(data);
  if (!match) return null;
  const expected = handoffCallbackData(match[1]);
  return Buffer.byteLength(expected) === Buffer.byteLength(data) && timingSafeEqual(Buffer.from(expected), Buffer.from(data)) ? match[1] : null;
}
export async function telegramInternalRequest(method: string, body: unknown, request: typeof fetch = fetch): Promise<unknown> {
  if (!process.env.TELEGRAM_BOT_TOKEN) throw new AgentError('INTERNAL_TELEGRAM_UNCONFIGURED');
  const response = await request(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10_000), cache: 'no-store' });
  const parsed = z.object({ ok: z.boolean(), result: z.unknown().optional() }).safeParse(await response.json());
  if (!response.ok || !parsed.success || !parsed.data.ok) throw new AgentError('INTERNAL_TELEGRAM_REJECTED');
  return parsed.data.result;
}
export async function sendHandoffTelegram(text: string, handoffId: string, request: typeof fetch = fetch, conversationId?: string): Promise<DeliveryResult> {
  if (!handoffTelegramConfigured()) return { status: 'FAILED', errorCode: 'INTERNAL_TELEGRAM_UNCONFIGURED' };
  try {
    const response = await request(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: process.env.TELEGRAM_CHAT_ID, text: text.slice(0, 3900), protect_content: true, reply_markup: { inline_keyboard: [[{ text: 'Забрал клиента', callback_data: handoffCallbackData(handoffId) }], [{ text: 'Открыть чат', url: new URL(conversationId ? `/admin/messages/${encodeURIComponent(conversationId)}` : '/admin/messages', process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lumacleanrs.com').href }]] } }), signal: AbortSignal.timeout(10_000), cache: 'no-store' });
    if (response.status >= 500) return { status: 'UNKNOWN', errorCode: 'DELIVERY_OUTCOME_UNKNOWN' };
    if (response.status === 429) return { status: 'FAILED', errorCode: 'TELEGRAM_RATE_LIMIT' };
    const parsed = z.object({ ok: z.boolean(), result: z.object({ message_id: z.number().int() }).optional() }).safeParse(await response.json());
    return response.ok && parsed.success && parsed.data.ok && parsed.data.result ? { status: 'DELIVERED', externalMessageId: String(parsed.data.result.message_id) } : { status: 'FAILED', errorCode: 'TELEGRAM_REJECTED' };
  } catch { return { status: 'UNKNOWN', errorCode: 'DELIVERY_OUTCOME_UNKNOWN' }; }
}
/** Called under the same conversation lock as Inbox/AI transitions. */
export async function resolveHandoffNotifications(tx: Tx, conversationId: string, userId: string, resolution: string) {
  await tx.humanHandoff.updateMany({ where: { conversationId, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedById: userId, resolution } });
  await tx.notification.updateMany({ where: { conversationId, kind: { in: handoffKinds }, deliveryState: 'PENDING' }, data: { deliveryState: 'CANCELLED', status: 'CANCELLED' } });
}
/** Serializes acknowledgement against a reminder's last check + Telegram side effect. */
export async function deliverHandoffNotification(db: PrismaClient, id: string, leaseKey: string, deliver: (text: string, handoffId: string, conversationId: string) => Promise<DeliveryResult> = (text, handoffId, conversationId) => sendHandoffTelegram(text, handoffId, fetch, conversationId)) {
  const row = await db.notification.findUniqueOrThrow({ where: { id } });
  if (!row.conversationId) throw new AgentError('INVALID_HANDOFF');
  return db.$transaction(async tx => {
    await schedulingLock(tx, 'conversation', row.conversationId!);
    const current = await tx.notification.findUniqueOrThrow({ where: { id } });
    if (current.leaseKey !== leaseKey || current.deliveryState !== 'SENDING') return { status: 'FAILED' as const, errorCode: 'HANDOFF_CANCELLED' };
    const payload = payloadSchema.parse(current.payload);
    const [handoff, c] = await Promise.all([tx.humanHandoff.findUnique({ where: { id: payload.handoffId } }), tx.conversation.findUnique({ where: { id: row.conversationId! } })]);
    if (!handoff || handoff.conversationId !== row.conversationId || handoff.resolvedAt || !c || c.control !== 'HUMAN_CONTROL' || c.ownerId) {
      await tx.notification.update({ where: { id }, data: { deliveryState: 'CANCELLED', status: 'CANCELLED', leaseKey: null, leaseUntil: null } });
      return { status: 'FAILED' as const, errorCode: 'HANDOFF_CANCELLED' };
    }
    const result = await deliver(row.text, payload.handoffId, row.conversationId!);
    if (result.externalMessageId) await tx.notification.update({ where: { id }, data: { payload: { ...payload, telegramMessageId: result.externalMessageId } } });
    // Start two minutes after the first send, not while the AI is still working.
    // An ambiguous first send is never retried; one reminder still attracts attention.
    if (row.kind === 'HANDOFF_TELEGRAM' && ['DELIVERED', 'UNKNOWN'].includes(result.status)) await tx.notification.upsert({ where: { eventKey: `handoff:${payload.handoffId}:telegram:reminder` }, create: { eventKey: `handoff:${payload.handoffId}:telegram:reminder`, conversationId: row.conversationId, userId: row.userId, audience: 'ADMIN', kind: 'HANDOFF_REMINDER', channel: 'TELEGRAM', text: `⏰ Клиент ещё ждёт человека (2 минуты)\n${row.text}`, payload: { handoffId: payload.handoffId, reason: payload.reason }, scheduledAt: new Date(Date.now() + handoffReminderDelayMs), deliveryState: 'PENDING' }, update: {} });
    return result;
  }, { maxWait: 10_000, timeout: 25_000 });
}
export async function claimTelegramHandoff(db: PrismaClient, raw: unknown, request: typeof fetch = fetch) {
  const update = handoffCallbackSchema.parse(raw), query = update.callback_query;
  if (!query) return 'IGNORED';
  const id = callbackHandoffId(query.data);
  const target = process.env.TELEGRAM_CHAT_ID;
  if (!id || String(query.message.chat.id) !== target) throw new AgentError('HANDOFF_FORBIDDEN');
  if (query.message.chat.type === 'private') {
    if (String(query.from.id) !== target) throw new AgentError('HANDOFF_FORBIDDEN');
  } else {
    // A copied/forwarded button does not grant access. Verify actual membership of our internal chat.
    const member = z.object({ status: z.enum(['creator', 'administrator', 'member']) }).safeParse(await telegramInternalRequest('getChatMember', { chat_id: target, user_id: query.from.id }, request));
    if (!member.success) throw new AgentError('HANDOFF_FORBIDDEN');
  }
  const handoff = await db.humanHandoff.findUnique({ where: { id } });
  if (!handoff) return 'EXPIRED';
  return db.$transaction(async tx => {
    await schedulingLock(tx, 'conversation', handoff.conversationId);
    const [current, c, notification] = await Promise.all([tx.humanHandoff.findUniqueOrThrow({ where: { id } }), tx.conversation.findUniqueOrThrow({ where: { id: handoff.conversationId } }), tx.notification.findFirst({ where: { conversationId: handoff.conversationId, audience: 'ADMIN', kind: { in: handoffKinds }, eventKey: { startsWith: `handoff:${id}:telegram` } }, orderBy: { createdAt: 'asc' } })]);
    if (current.resolvedAt || c.control !== 'HUMAN_CONTROL' || c.ownerId) return 'ALREADY_CLAIMED';
    const owner = notification?.userId ? await tx.user.findUnique({ where: { id: notification.userId }, select: { id: true, active: true, role: true } }) : null;
    if (!owner?.active || owner.role !== 'ADMIN') throw new AgentError('HANDOFF_OWNER_UNAVAILABLE');
    await resolveHandoffNotifications(tx, c.id, owner.id, 'Клиент забран из Telegram');
    await tx.conversation.update({ where: { id: c.id }, data: { ownerId: owner.id, needsAttention: false, operatorTypingUntil: null, shadowProposal: Prisma.DbNull, revision: { increment: 1 } } });
    await tx.message.updateMany({ where: { conversationId: c.id, author: 'AI', deliveryStatus: 'PENDING' }, data: { deliveryStatus: 'CANCELLED' } });
    await writeAudit(tx, { type: 'SYSTEM', key: 'telegram:' + createHash('sha256').update(String(query.from.id)).digest('hex').slice(0, 16) }, { action: 'TELEGRAM_HANDOFF_CLAIMED', entityType: 'HumanHandoff', entityId: id });
    return 'CLAIMED';
  });
}
