# Telegram handoff alerts

The existing internal `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` receive AI handoff alerts. The separate customer Telegram channel can remain OFF. Website AI mode is unchanged.

Each committed handoff creates an internal Inbox notification and a durable Telegram outbox row. Telegram shows **Забрал клиента** and **Открыть чат**, linking directly to the conversation. After the first successful (or ambiguous) send, one reminder is scheduled for 120 seconds later using the existing Vercel notification queue. There is no third reminder. Definite rate limits retry; ambiguous sends are never replayed.

Acknowledging in Telegram or taking over/replying/closing/resuming in Inbox resolves the handoff and cancels its pending alerts. The worker rechecks handoff/control under the same conversation lock immediately before sending. Concurrent callbacks have one winner. Acknowledgement assigns the conversation to the existing internal notification's active admin; Telegram group members are not provisioned as admin accounts. The AuditLog records a SYSTEM event with a hashed Telegram actor.

`TELEGRAM_HANDOFF_WEBHOOK_SECRET` authenticates `/api/telegram/handoff` and signs callback data. Only the configured private recipient, or a verified member of the configured internal group, can acknowledge. Forwarded, foreign, malformed and repeated callbacks cannot take a different conversation. Telegram setup is authenticated, ADMIN-only, production-only and refuses to replace an unrelated webhook.

With a newly generated secret deployed, POST `{ "action": "configure" }` to `/api/admin/telegram-handoff` using an authenticated owner session and the site's Origin. `{ "action": "status" }` reports safe configuration metadata. No bot credential is returned. Only `callback_query` updates are subscribed, without dropping pending updates.

The existing daily recovery reconciles the durable outbox if publishing fails; the normal two-minute path uses delayed queue delivery, not daily cron or an in-process timer. Queue outages may delay notification delivery. If the internal chat is a group, the bot must be able to verify members (`getChatMember`; Telegram guarantees this when the bot is a group administrator).

No database migration or historical order recalculation is needed. Tests run only on the isolated Preview database; production smoke must not create an Order and must remove its scoped synthetic conversations and notifications afterward.
