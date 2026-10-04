# AI go-live

Branch: `codex/admin-ai-go-live`, based on `codex/admin-ai-agent`. Production stays SHADOW. Models remain env-configured PoYo `gpt-6-luna` and OpenRouter `openai/gpt-6-luna`; no new benchmark.

## Owner activation

Open `/admin/settings` → **Запуск AI**. Run diagnostics (small billable native model probes, real Google Places autocomplete and Google Transit matrix). Results expire after one hour and invalidate when credentials/models change. Keys and provider payloads never appear in UI. Map JS configuration is reported separately; check actual map loading in Routing after adding the restricted browser key.

Server refuses AUTO if credentials/probes, active Duration Rules for the selected services, active cleaner hours/start coordinates, pricing, Belgrade timezone/buffer, canary/channel configuration or source-matched test evidence are missing. The owner must also explicitly confirm AUTO. SHADOW review shows accepted/rejected/sample size, without a fabricated statistical pass rate or self-training. Resolve rejected suggestions and review real conversations before activation.

Global OFF stops all AI channels; SHADOW caps every enabled channel at SHADOW. Website scope defaults AUTO under the global SHADOW ceiling; Telegram/WhatsApp/Viber default OFF. Only limited AUTO is supported. Exceptions, out-of-scope services, strong dirt, discounts, complaint, mold, renovation, routing/price failures and repeated tool errors hand off. Scope reductions and OFF remain possible even if health deteriorates. Increasing AUTO scope runs the same server gate.

## Duration

Settings initial wizard: regular **1–100 m² / 2 cleaners / 150 min**; deep **40–60 m² / 2 cleaners / 480 min**, centered around the owner's 50 m² full-day observation. These are editable starting assumptions, not an extrapolated statistical model. Nothing is activated by migration. The owner sees every parameter and checks confirmation before activating a version. Null extra duration means unknown; zero means an explicitly configured zero.

Technical status is CONFIGURED or PARTIALLY_CONFIGURED for a usable estimate. Missing rules/bands, or unknown extras without a configured uncertainty reserve, yield UNCONFIGURED in the agent result and prohibit booking. A partial estimate uses **additional configured reserve per unknown extra quantity** in the existing scheduling engine; this reserve is not a fabricated cleaning-duration estimate. Existing rule defaults remain reserve 0 and retain their former conservative behavior. Historical order snapshots are preserved.

## Outbox and limits

Notification records commit with business events. Delivery occurs separately. Booking/change/cancellation generate owner/client/cleaner events; future customer reminders and cleaner tomorrow records are scheduled 24 hours before the booking. Website-only and unconnected cleaner recipients retain internal records. Website chat reads only its server-bound client's internal notifications.

Private `lumaclean-notifications` Vercel queue uses opaque notification IDs, delayed delivery, recipient checks, CAS leases and idempotent event keys. Definite Telegram 429 retries have bounded backoff. Ambiguous network/5xx sends and stale SENDING leases become UNKNOWN and are never automatically resent (Telegram has no send idempotency key). Rescheduling/cancelling invalidates pending reminders; a worker rechecks the order snapshot. Queue publication failure cannot roll back an order. Daily Hobby-compatible `/api/agent/recover` repairs publication and refreshes reminders within six days; normal delivery uses delayed queue messages. No SMS or new WhatsApp/Viber integration.

Settings bound anonymous messages, model calls (including fallback), native tool iterations, conversation cost and daily cost warning. Existing conservative env daily budget remains a separate hard ceiling. Unknown successful model cost stops subsequent calls. Exhaustion hands off. Mode/revision/lease checks guard each model attempt, tool and reply persistence. Telemetry stays separate from AuditLog.

## Verification and release evidence

Targeted tests cover RU and SR Latin booking, flexible windows, verified repeat customer/own address, address selection, competing slot, strong dirt/discount handoff, Google outage, native fallback, confirmation/receipt, source checks, channel scopes, OFF while in flight, cost/loop/message bounds, review snapshots, additive legacy-data migration and notification retries/idempotency/crash recovery. Local staging uses **real PostgreSQL and explicitly mocked Google/provider responses**. Live Google booking in Preview is blocked until real credentials/cleaners/rules exist; these mocks are never installed into runtime routing.

`scripts/admin/ai-go-live.ts preview diagnostics` checks real provider connections. `preview fallback` forces primary unavailable and uses the real native OpenRouter fallback in SHADOW; it asserts business counts unchanged and never creates a production order. Temporary Preview verification access is revoked after release.

`release/ai-go-live.json` records checks performed on this release. Next build recomputes a fingerprint of deployable source, schema/migrations, package lock and Next config. Vercel-owned vercel.json is rewritten by the platform builder and is validated by Vercel separately. Modified or missing source evidence disables AUTO; it is not a client-side flag. Regenerate evidence only after rerunning relevant checks. Browser checks cover Website Chat desktop/390, Settings blocker/initial wizard, Inbox review and CRM/calendar smoke. Production verification is read-only apart from safe diagnostics, and leaves SHADOW unchanged.

## Current owner configuration required

- Add `GOOGLE_MAPS_SERVER_API_KEY` (Places API New + Routes API, billing and suitable server restrictions) and `NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_API_KEY` (Maps JavaScript API, site referrer restrictions). Optional `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` for the map style.
- Add real active cleaners, working hours, Google-confirmed starting addresses and coordinates; payout percentage does not block scheduling.
- Confirm/activate Duration Rules and configure extras/reserve. Select the intended AUTO services.
- Review SHADOW suggestions in Inbox, rerun live diagnostics, verify real Preview booking/Transit, then explicitly enable limited Website AUTO. Keep unused channels OFF. Telegram requires its separate customer token and webhook secret; internal bot is never substituted.
