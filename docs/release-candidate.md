# LumaClean release candidate — 19 October 2026

Status: **release blocked**. Production project, database, channel modes and source PRs are unchanged.

## Integrated sources

Base main: `93e8e3d34ff51eaffa42cb98950756c97623cee8`.

| Source | Exact head included as ancestor | Result |
| --- | --- | --- |
| #24 | `0fa99d9e872f214d45f00bafddef3f60d750783a` | Webhook, durable notification outbox, ambiguity handling, limiter, CRM recovery |
| #23 | `8b2f39ff85b1fce028e850acc653e5d8ef14e0a9` | Approved homepage, animations, both forms, optional name, CONTACT_REQUEST, RU/SR/EN |
| #21 | `83ec330d7474fc0b320d8abc2fa6504b8852205d` | Prices already present through #23; ancestry retained without duplicate price edits |

The four anticipated conflicts were resolved in `api/lead/route.ts`, `website-leads.ts`, `lead-notifications.ts`, `estimate.tsx`. The #24 patch passed `git apply --cached --check` against the exact #23 tree and was used only as a reference. A subsequent release-evidence conflict with #21 retained #23 evidence until new source-matched checks were recorded. No #22/#18 changes were imported. Source PRs remain open and would become redundant only after a separately approved successful release.

Additional narrow fixes: both forms show localized 429 feedback without resetting their fields; manager links use the exact Preview deployment origin; the existing `#method` anchor is retained with menu labels Условия/Uslovi/Terms; synchronous queue publication precedes the HTTP acknowledgment, while Telegram delivery stays in the existing worker. Authorized CRM recovery also accepts due PENDING events older than two minutes, with the worker lease protecting sends. UNKNOWN, confirmed receipts and active sends cannot be reset.

## Preview isolation — PASS

Separate, owner-authorized Vercel project: `lumaclean-release-candidate`, ID `prj_Dzc8yXL61u8r8vmKewjRtK9ZrTdk`, same existing team and free plan. Original `lumaclean` project has no Git connection, so its API rejected branch-specific env overrides; no shared Preview variables were changed.

Preview: https://lumaclean-release-candidate-27zwx76r6.vercel.app

Neon project `patient-butterfly-42300600`; independent branch `br-rough-bread-b8y7ehd6`, endpoint `ep-icy-smoke-b8pu84zj`, cloned from the existing isolated #23 test branch `br-jolly-cherry-b8tu1iod`. DATABASE_URL/DIRECT_URL are scoped only to the new project's Preview environment. Separate auth/proof secrets; Telegram, WhatsApp and Viber credentials are empty; AI/provider/routing credentials are absent. Persistent BusinessSettings modes were not modified. Queue topics are scoped to the separate Vercel project. Original production endpoint `ep-bitter-mode-b8r8ruag` was never used for writes.

The deployment target is Vercel's API `staging` (Preview runtime), with noindex headers and Vercel Authentication. The new project's first implicit production-target build was canceled before READY; it had no production-target DB credentials. It never touched the business production project or domain.

Four synthetic form scenarios were confirmed in this Neon branch and in authenticated Preview CRM; Notification text contains this exact Preview origin. No orders were created, and production CRM/scheduling/staff/finance cannot receive these test records. Test admin sessions/account were removed after verification. Synthetic enquiries remain only in the isolated test CRM for review.

## Delivery and recovery

- Typical healthy path: publish before HTTP response, queue worker usually within seconds. This is an expectation, not a measured Telegram delivery SLA; real Telegram receipt is BLOCKED.
- Queue unavailable: Lead + Notification + audit remain committed; `after()` attempts delivery through the same leased worker. Callback/registration errors cannot turn a saved lead into an intake failure.
- Crash after commit but before successful publish: the durable PENDING event remains. The next existing recovery sweep can find it; administrator can open the Lead and use recovery after two minutes. CRM commands also publish pending events.
- Crash during a possibly completed send: expired SENDING becomes UNKNOWN; it is never automatically resent. Check the intended chat before manual business handling.
- Production fallback cron remains `0 6 * * *`. Hobby supports daily cron with up to one hour of timing imprecision; nominal worst case is roughly 25 hours if no other recovery runs. There is no finite guarantee while a dependency remains unavailable. No new paid scheduler was introduced. Preview cron is not scheduled automatically.
- CRM displays PENDING/SENDING/confirmed/FAILED/UNKNOWN, attempts, next attempt and error. An administrator should inspect old PENDING and FAILED/UNKNOWN enquiries and contact the customer or restore a definitely unsent notification. No automatic real-time stuck-alert guarantee exists.

Vercel references: https://vercel.com/docs/cron-jobs/usage-and-pricing and https://vercel.com/docs/cron-jobs .

**Telegram: BLOCKED by owner decision.** No dedicated test bot/chat was supplied. Actual Preview worker attempts retained `INTERNAL_TELEGRAM_UNCONFIGURED`, retry timestamps and no Telegram message ID. No production token/chat was substituted, and no real Telegram messages were sent. To close: configure only a separate test bot/chat in this test project, redeploy, run ordinary + CONTACT_REQUEST receipt/deduplication checks and confirm actual receipt in the intended chat; a DB status alone is insufficient.

## Migrations and prices

Apply all pending Prisma migrations in timestamp order, including:

1. `20261018190000_optional_website_lead_name`
2. `20261018190100_contact_request_kind`
3. `20261019220000_website_notification_recipient`

All 25 migrations replayed on a disposable local database. Legacy Lead and Order row snapshots survived the three release migrations; null-name cleaning, null service/area/price CONTACT_REQUEST, and the narrow manager-chat recipient case passed. On the isolated Neon branch the third migration was pending and applied successfully; count/hash fingerprints of existing Lead/Order/catalogue/settings/finance rows were unchanged. No production migrations ran.

Windows are 700 / 1,000 RSD in public/CRM pricing and AI knowledge. The existing catalogue script's dry run on the isolated Neon branch reported `changes: []`; protected historical fingerprints were unchanged. During an approved production release, first run `scripts/admin/update-window-pricing.ts` without `--apply` against the intended database, review only the two prospective window entries, then explicitly authorize any required update. Existing Order/OrderExtra prices must remain unchanged.

## Verification

| Check | Result |
| --- | --- |
| Full existing suite | 986 PASS, 28 SKIP (separate integration credentials unavailable) |
| Targeted isolated PostgreSQL HTTP/outbox regressions | 17 PASS: HUMAN_CONTROL all transports, AI job recovery, duplicates, SHADOW, CLOSED, all intake kinds, queue failure, UNKNOWN, authorization, 429/idempotency |
| Ordered migration replay with legacy fixtures | 1 PASS; all 25 migrations |
| Preview HTTP → DB → authenticated CRM | PASS: four intents, no name, same submission deduplication, 16 accepted / 4 limited additional parallel POSTs, no new Order, Preview links |
| Actual Preview outbox worker | Attempt/retry state verified; test Telegram receipt BLOCKED |
| typecheck / lint / build | PASS; two existing website-chat img warnings |
| Native AI booking proof | BLOCKED: missing approved AI/provider/address/routing credentials and readiness checks in new project; prior proof is not valid for this source/config |
| Browser visual QA 1440/1024/390 | BLOCKED: repeated CUA inventory says local browser use is disabled in Work settings. HTTP/static preservation does not prove animation/layout correctness. |

Source-matched `release/ai-go-live.json` records only executed automated checks. It does not certify native booking, real Telegram receipt or browser QA. Approved homepage structure, apartment/video assets and price animations are preserved from #23; no redesign was performed.

Deferred debt remains as documented in `docs/reliability-hardening.md`: observe PostgreSQL warnings after the local transaction fix, measure SSE polling, and confirm external consumers before removing legacy upholstery routes.

No deletion capability is exposed for the obsolete #22 deployment. Exact ID `dpl_GfQccoojYBw2jFm7CVrPcvXQuzjy` is not used. Manual deletion of this deployment only: https://vercel.com/vladislavs-projects-0eae0ea3/lumaclean/GfQccoojYBw2jFm7CVrPcvXQuzjy .

## Future release sequence — do not execute yet

Close test Telegram receipt/deduplication, approved native booking proof, and browser QA/owner acceptance. Recheck source heads and source evidence. Obtain separate production approval. Take a backup/restore point, apply reviewed additive migrations, dry-run and authorize any catalogue update, build/release this exact reviewed source, then check ingress/outbox/CRM and receipt telemetry. Do not close source PRs until the release is accepted. Application rollback must preserve the additive schema and all historical rows.
