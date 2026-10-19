# LumaClean reliability hardening

Branch: `codex/reliability-hardening`, based on `main` `93e8e3d`. PR: https://github.com/boooobly/lumaclean/pull/24.
Preview: https://lumaclean-git-codex-reliabi-01c36e-vladislavs-projects-0eae0ea3.vercel.app/ru.
No production deployment, migration, merge, channel-mode change, model/prompt change or owner/customer test message was performed.

| Finding | Status | Result |
|---|---|---|
| False 503 after HUMAN_CONTROL ingress | Fixed | Optional job lookup; existing Inbox unread/attention/ownership behavior retained. Pending AI work republishes on replay; queue failure also schedules the existing worker after response. |
| Ordinary cleaning bypassed the durable notification worker | Fixed | Every new public Lead commits its Notification and audit atomically. Submission replay cannot add a second event. Publication runs after response; queue outage can fall back to the same leased worker. |
| Notification retry and delivery ambiguity | Fixed | Confirmed success is terminal. 429/unconfigured delivery uses bounded backoff. Timeout, 5xx, malformed success and expired sending leases become UNKNOWN and are never blindly resent. Lead status and outbox result commit together; provider message ID is retained. |
| CRM recovery | Fixed | Shows pending/sending/confirmed/failed/unknown, attempts, next retry and error code. Authorized retry command accepts only definite FAILED states; UNKNOWN, confirmed delivery and legacy events cannot be resent. |
| No active CRM admin | Fixed; migration required | The existing SQL recipient constraint otherwise prevents atomic outbox creation. A narrow additive migration permits only manager-chat WEBSITE_LEAD events without a CRM user; historical rows are unchanged. Tested locally only. |
| Spam | Fixed | Existing PostgreSQL RateLimit table, atomic transaction updates, 20 new enquiries/10 minutes and 100/day per source. Idempotency runs first. HTTP 429, Retry-After and localized feedback. No contact data in limiter keys/logs. |
| IP trust | Fixed for current Vercel ingress | Only VERCEL=1 trusts a single validated platform-overwritten x-forwarded-for; other hosts use one shared fallback bucket. HMAC keys and IPv6 /64 grouping. Any future hosting/proxy change must revisit this policy. |
| SHADOW / CLOSED / PAUSED | Checked | SHADOW retains suggestions without customer sends; CLOSED rejects new messages under the existing policy and accepts saved replays. PAUSED does not exist in ConversationControl; OFF is the applicable disabled agent mode and consumes jobs without invoking AI. |
| PostgreSQL deprecation | Local fix; telemetry verification required | Removed parallel transaction queries in both Telegram handoff paths. They share a single pg connection and are a plausible source. No driver/pool changes. Last-week logs cannot be retrieved with this project's Hobby retention; recent 50-minute warning query returned no groups. This does not prove every source is resolved. |
| Sitemap | Fixed | Explicit content revision dates now reflect 17 October pricing/upholstery updates from Git history. Articles continue using article.updatedAt. Update src/lib/content-revisions.ts with future material content changes; request/deployment time is never used. |
| Legacy upholstery APIs | Deferred | No current src caller for /api/upholstery or /api/upholstery/lead. External integrations cannot be excluded from source inspection. Retain both; inspect path-only usage over an agreed observation period, confirm integration owners, then deprecate and remove separately while retaining historical Lead/quote data. |
| Chat database load | Deferred | SSE calls publicConversation every 1.5 seconds, at least four queries per snapshot: roughly 160 queries/minute per connected tab, plus attachment loading. The connection remains while a conversation exists, including a closed widget; error fallback polls every 18 seconds. First proposal: pause while hidden/closed, adaptive idle interval, cheap change signal before a full snapshot. No transport rewrite here. |

Vercel documents that its ingress overwrites x-forwarded-for: https://vercel.com/docs/headers/request-headers.

## PR #23 integration

PR #23 remains unchanged at `8b2f39f`. A separate detached local checkout combined its UX with these fixes; no remote merge was made.
Four textual conflicts need resolution: `src/app/api/lead/route.ts`, `src/lib/services/website-leads.ts`, `src/lib/services/lead-notifications.ts`, `src/components/site/estimate.tsx`.

- Keep this PR's rate-limited API and unconditional atomic enqueue/worker notification path. Keep #23's CONTACT_REQUEST branch, null service/area/price and optional name inside saveWebsiteLead.
- Keep this PR's nullable-name/contact-aware notification formatter. Do not restore the direct Telegram HTTP send or conditional enqueue from #23.
- Keep #23's form/UX/pricing; add this PR's 429 state in estimate.tsx. Also add localized 429 feedback in #23-only `src/components/site/contact-request.tsx`.
- Retain #23's existing optional-name/contact-kind migrations, plus this PR's notification-recipient migration. No production migration has been executed.
- A ready local patch against #23 head is in `artifacts/pr23-reliability-integration.patch`; use only in an integration checkout based on that exact head, with `git apply --check` before applying. It is not a patch for main.

The isolated merged checkout passed the same 13 regressions and an additional CONTACT_REQUEST HTTP test: no name/quote fields, consent, one Lead/event on retry, controlled worker delivery, rate limiting and no Order. Typecheck, production build and lint were also checked. This is compatibility evidence, not a production release or real Telegram proof.

## Validation and release gates

- Main: 13 targeted PostgreSQL/HTTP checks pass. Existing suites: 962 pass, 27 environment-dependent skips, 0 failures. Two date-dependent routing tests now inject a fixed clock; routing implementation is unchanged.
- Standard typecheck/build pass. Lint: 0 errors, 2 pre-existing website-chat img warnings; generated copied maplibre code is excluded.
- Target tests used PostgreSQL on `127.0.0.1:55441/lumaclean_reliability_test`, complete local migration SQL, synthetic fixtures and provider stubs. They guard the database host/name before writing. No test used production credentials.
- Run: `node --conditions=react-server --import tsx --test tests/reliability/*.test.ts`, with RELIABILITY_TEST_DATABASE_URL and RELIABILITY_TEST_BASE_URL set to the isolated local database and local app. Without those variables the integration suite skips explicitly.
- Preview smoke only: main page/sitemap 200, noindex, unauthenticated recovery 401, GET /api/lead 405. No Preview form submission or real Telegram delivery is claimed.
- TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID exist only for production, absent in Preview. INTERNAL_TELEGRAM_UNCONFIGURED is therefore expected. Provision a separate test bot/chat in Preview, confirm its destination with its owner, submit a synthetic Lead, verify Telegram message_id/outbox/CRM and actual receipt, then replay the request and confirm one manager message. Do not copy the production owner chat into Preview.
- UNKNOWN requires checking the actual chat before any reconciliation. Legacy FAILED leads without an outbox may have been delivered; do not bulk backfill/resend them.
- Existing recovery cron runs daily on Hobby. Request/queue fallback reduces delay, but a crash before publication can still wait for recovery. This is delayed processing, not loss of committed records; faster independent recovery needs a separately agreed scheduler/plan.
- Refresh source-bound native booking proof and perform the approved migration/release procedure before production. This branch does not certify production readiness.

Rejected #22 deployment was verified by exact ID, project, Preview target and head SHA `70b5d341`: `dpl_GfQccoojYBw2jFm7CVrPcvXQuzjy`. No connected delete operation exists and CLI has no credentials, so it was retained. Manual page: https://vercel.com/vladislavs-projects-0eae0ea3/lumaclean/GfQccoojYBw2jFm7CVrPcvXQuzjy. Delete only that deployment after checking its full ID; retain production and all other Previews.
