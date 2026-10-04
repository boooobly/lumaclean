# Website Chat V2

The Website widget follows the conversation's server-detected RU, Serbian Latin, Serbian Cyrillic or English locale. A stable fictional display alias is stored on the conversation; it does not create a User. Inbox replies use the same alias.

## Response integrity

The supplied customer transcript showed a repeated greeting in a new response, not a duplicated database row. The continuation policy now moves directly to the newly supplied facts. Separately, each final AI response is unique by its CLIENT source message. UUID retries, lease recovery, concurrent drains and provider fallback cannot persist a second final response. Historical messages remain intact; only the earliest historical answer is linked during backfill.

Read receipts reflect actual job claim or the human operator's viewed message cutoff. Human typing uses a 3-second heartbeat and 7-second expiry, without AuditLog writes. Cookie-scoped SSE streams close after 45 seconds and reconnect; 18-second polling provides fallback.

## Quick replies and booking

The server localizes allowlisted intent keys and binds choices to the assistant message and state revision. Slot chips use actual, unexpired conversation-scoped tokens. Selecting a slot does not confirm a booking: live revalidation and explicit recap confirmation remain required. The existing readiness and mode checks still run immediately before createOrder.

## Private photographs

Four JPEG/PNG/WebP originals of up to 8 MB can be selected per message. The browser prepares a JPEG below 3 MB for the Vercel request limit; the server independently checks magic/MIME, decode bounds and pixel count, then re-encodes to a 2200-pixel display image and thumbnail without EXIF/GPS. HEIC is explicitly unsupported. SVG is rejected.

`ChatAttachmentStorage` uses Vercel Blob PRIVATE. Postgres holds metadata only. Downloads require the owning chat cookie or an authenticated admin; storage URLs and keys are never exposed to clients or models. `BLOB_READ_WRITE_TOKEN` is a server-only store credential. `CHAT_STORAGE_NAMESPACE` separates Preview objects from `chat/production/`. The existing recovery cron removes 24-hour unbound orphans and closed conversations after `CHAT_ATTACHMENT_RETENTION_DAYS` (default 90), while retaining attachments linked to active CRM records.

PoYo Responses and OpenRouter native chat APIs accept the processed images without disrupting function results. A successful image fallback remains preferred for subsequent steps of that job. If neither provider accepts images, the text fallback receives only the attachment count and must ask for a description or hand off. Pricing with customer photos also requires explicit customer text for area and dirt category. Images cannot set prices, discounts or booking facts.

## Verification

55 targeted tests passed: 47 policy/provider/Chat V2 tests, 7 HTTP/SSE/private Blob tests and one additive migration preservation test. Typecheck, affected lint and production build passed. The supplied two-turn conversation was reproduced successfully in Chrome; 390px and reduced-height viewports keep the input visible, with 46px initial and 112px maximum height. Physical iOS/Android keyboard testing is not represented by Chrome viewport emulation.

Real synthetic-image probes confirmed OpenRouter on all three fixtures and PoYo on the clean kitchen with native calculatePrice calls. PoYo's other two probes exceeded its 22-second timeout; failover and both-provider failure paths have targeted coverage. No production test Order is used for verification. Vercel Preview booking, cleanup and final deployment results are recorded separately.
