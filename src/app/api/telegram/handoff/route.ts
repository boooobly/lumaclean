import { after, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/database/client';
import { boundedBody } from '@/lib/services/admin-http';
import { AgentError } from '@/lib/agent/contracts';
import { claimTelegramHandoff, handoffCallbackSchema, telegramInternalRequest, verifyHandoffWebhook } from '@/lib/agent/telegram-handoff';

export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  if (!verifyHandoffWebhook(request.headers.get('x-telegram-bot-api-secret-token'))) return NextResponse.json({ ok: false }, { status: 403 });
  try {
    const update = handoffCallbackSchema.parse(JSON.parse((await boundedBody(request, 16_000)).toString()));
    const result = await claimTelegramHandoff(getDatabase(), update);
    if (update.callback_query) {
      const query = update.callback_query;
      after(async () => {
        try { await telegramInternalRequest('answerCallbackQuery', { callback_query_id: query.id, text: result === 'CLAIMED' ? 'Клиент забран. Напоминание отменено.' : 'Этот диалог уже забран или закрыт.' }); } catch { /* Claim is committed; expired Telegram UI acknowledgement must not undo it. */ }
        try { await telegramInternalRequest('editMessageReplyMarkup', { chat_id: query.message.chat.id, message_id: query.message.message_id, reply_markup: { inline_keyboard: [] } }); } catch { /* Old buttons remain safe and idempotent. */ }
      });
    }
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    const forbidden = e instanceof AgentError && e.code === 'HANDOFF_FORBIDDEN';
    return NextResponse.json({ ok: false }, { status: forbidden ? 403 : e instanceof SyntaxError || e instanceof Error && e.name === 'ZodError' ? 400 : 503 });
  }
}
