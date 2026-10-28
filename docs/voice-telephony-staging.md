# LumaClean voice intake — staging only

## Scope
- Separate ElevenLabs test agent (Sofija SR), not assigned to any real number.
- Quote endpoint: POST /api/integrations/voice/quote, shared deterministic pricing from src/lib/pricing.ts. No CRM writes. No inferred bookings.
- Lead endpoint: POST /api/integrations/voice/lead, only available when VERCEL_ENV=preview AND LUMACLEAN_VOICE_STAGING_ENABLED=true. Uses independent Preview Neon DB, authenticated bearer secret, idempotent conversation ID, persisted Lead and existing durable Telegram outbox. Human review required.
- No calls to production customers, no order creation, no phone number assignment.
- DO NOT set this staging write toggle on production. Enforce independent Neon branch before integration test.

## Secret
Set LUMACLEAN_VOICE_API_SECRET to a random 32+ character string as a Vercel Preview env var and configure the matching secret header in ElevenLabs webhook tools. Never commit or log it. Do not expose a public unsigned read tool in a live environment. Link only to a specific tested Preview origin, NOT localhost/production.

## ElevenLabs tool schemas
**quote:** JSON POST with `service` (regular/deep/move/airbnb/office), `area` (25–180), `extras` (optional array of code, quantity), `urgent` (optional). Reply is indicative in RSD.
**lead:** JSON POST with `conversationId` (stable ElevenLabs conversation id), `phone` (caller-confirmed), `name` (optional), `service` and `area` (together or both null), `notes` (short summary) and `consentToContact: true`. Never submit without explicit caller permission. This is an enquiry, not a booking. A retry with the same conversation ID and different payload is rejected, not overwritten.

## Business behavior
- Price is preliminary. Final price, availability and booking require a human.
- For details and photographs, direct clients to Viber +381 65 347 0308. No automatic Viber message is sent.
- Do not claim that Viber messages have been sent or that the client is automatically moved to Viber.
- Telephone carrier SIP/number procurement is a separate step; check local registration documentation and exact recurring and per-minute call costs.
- Review Serbian voice pronunciation before live traffic; a default or English-accent voice is unacceptable for release.

## Before release
- Test unauthenticated requests, all schemas, rate limiting/budget controls, replay/concurrency, isolated DB, Telegram receipt in test destination, error recovery and multilingual voices.
- Voice lead write endpoint is staging-only and should remain so until a separate production gating PR has been reviewed and approved.
- Add call event signature verification/authoritative conversation verification before production: possession of a webhook bearer token is insufficient to trust arbitrary conversationId or contact consent.
- No independent call is allowed to claim that caller consent occurred based solely on model-generated input.
- Verify local law on call-recording notice, consent, privacy and retention, and use data minimization by default.
