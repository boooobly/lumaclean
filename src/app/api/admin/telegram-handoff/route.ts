import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCurrentUser } from '@/lib/auth/session';
import { getDatabase } from '@/lib/database/client';
import { adminRateLimit, boundedBody } from '@/lib/services/admin-http';
import { writeAudit } from '@/lib/services/audit';
import { AgentError } from '@/lib/agent/contracts';
import { handoffTelegramConfigured, telegramInternalRequest } from '@/lib/agent/telegram-handoff';

export const runtime = 'nodejs';
export const maxDuration = 60;
/** Configure the existing internal bot without exporting its production credential. */
export async function POST(request: Request) {
  if (process.env.VERCEL_ENV !== 'production' || request.headers.get('origin') !== process.env.BETTER_AUTH_URL || !request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false }, { status: 401 });
    if (user.role !== 'ADMIN') return NextResponse.json({ ok: false }, { status: 403 });
    await adminRateLimit(user.id, 'telegram-handoff-setup', 5);
    const input = z.object({ action: z.enum(['status', 'configure']) }).strict().parse(JSON.parse((await boundedBody(request, 1000)).toString()));
    if (!handoffTelegramConfigured()) throw new AgentError('INTERNAL_TELEGRAM_UNCONFIGURED');
    const origin = new URL(process.env.BETTER_AUTH_URL!);
    if (origin.protocol !== 'https:') throw new AgentError('HTTPS_REQUIRED');
    const url = new URL('/api/telegram/handoff', origin.origin).href;
    const [webhook, chat] = await Promise.all([
      telegramInternalRequest('getWebhookInfo', {}).then(raw => z.object({ url: z.string(), pending_update_count: z.number(), last_error_date: z.number().optional() }).parse(raw)),
      telegramInternalRequest('getChat', { chat_id: process.env.TELEGRAM_CHAT_ID }).then(raw => z.object({ type: z.enum(['private', 'group', 'supergroup']) }).parse(raw)),
    ]);
    if (webhook.url && webhook.url !== url) throw new AgentError('EXISTING_TELEGRAM_WEBHOOK_CONFLICT');
    if (input.action === 'configure') {
      await telegramInternalRequest('setWebhook', { url, secret_token: process.env.TELEGRAM_HANDOFF_WEBHOOK_SECRET, allowed_updates: ['callback_query'], drop_pending_updates: false });
      await getDatabase().$transaction(tx => writeAudit(tx, { type: 'USER', userId: user.id }, { action: 'TELEGRAM_HANDOFF_WEBHOOK_CONFIGURED', entityType: 'BusinessSettings', entityId: 'default' }));
    }
    return NextResponse.json({ ok: true, configured: input.action === 'configure' || webhook.url === url, recipientType: chat.type, pendingUpdates: webhook.pending_update_count }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return NextResponse.json({ ok: false, error: e instanceof AgentError ? e.code : 'TELEGRAM_SETUP_FAILED' }, { status: 400 }); }
}
