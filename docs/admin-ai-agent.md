# LumaClean AI administrator

Branch: `codex/admin-ai-agent`, based on `codex/admin-finance-duration`. Production starts in **SHADOW**; the owner must explicitly enable AUTO in Inbox/Settings after reviewing conversations and configuring duration/routing. OFF accepts messages and allows owner replies. `AI_AGENT_ENABLED=false` is the server kill switch.

## Live synthetic benchmark — 2026-10-01

30 synthetic scenarios × 5 provider/model combinations, native tools, RU / Serbian Latin / Serbian Cyrillic / EN. No CRM or production PII. Catalog IDs and native protocols were checked through provider APIs before execution. Scores weight tools 35%, business discipline 25%, communication proxy 15%, four booking workflow cases 10%, latency 10%, cost 5%. Exact quote parameters were checked from recorded native calls. Provider failures earn no speed/cost credit.

| Provider | Model | Score /100 | Quality /100* | Tool accuracy | Avg scenario latency | Avg scenario USD |
|---|---|---:|---:|---:|---:|---:|
| PoYo | `gpt-6-luna` | **84.7** | 86.3 | **80.0%** | 10.86 s | $0.000252 |
| OpenRouter | `openai/gpt-6-luna` | 82.7 | 81.2 | 66.7% | **3.79 s** | $0.000273 |
| PoYo | `gpt-5-6-luna` | 75.9 | 74.9 | 56.7% | 7.81 s | $0.000581 |
| OpenRouter | `google/gemini-3.8-flash` | 42.4 | 43.5 | 36.7% | 11.18 s | $0.002437 |
| PoYo | `claude-sonnet-5` | 0.0 | 0.0 | 0.0% | 0.80 s (failed) | Unknown (all HTTP 500) |

*Quality normalizes the 85 non-cost/non-latency points. Communication is script/brevity/question-count screening, not a human fluency rating. Selected RU/SR/EN quote and FAQ answers were reviewed for script and wording. All successful quote calls used the expected service, area, soil, extras and urgency. Strict workflow failures include safe refusals that omitted an expected handoff/findClient/Places tool; this is deliberately not reported as perfect autonomy. Gemini suffered 429/continuation errors; Sonnet's tested PoYo chat tool endpoint failed every scenario. Zero recorded token usage on an error is not proof of zero billed usage. Thirty cases are a small sample, sufficient to select a SHADOW candidate, not a guarantee of production booking success.

**Primary:** PoYo `gpt-6-luna`, native Responses. **Fallback:** OpenRouter `openai/gpt-6-luna`, native Chat Completions. Rates used: primary $0.08/$0.40 per million input/output tokens; fallback $0.10/$0.50. An 8–12-message dialogue with approximately 25k input + 2k output tokens is **~$0.0028** primary / **~$0.0035** fallback. This is a projection; actual conversation cost is recorded in AI Analytics. Estimated benchmark usage cost: $0.1063 across all combinations, excluding unknown error billing.

Run `npm run benchmark:agent` only for explicit live provider checks. Ignored local artifacts retain synthetic answers/native tool calls/usage and exclude credentials and hidden reasoning. Automated tests mock providers; `npm run test:agent` uses an explicitly named disposable local database and local HTTP server when `AI_TEST_DATABASE_URL` / `AI_TEST_BASE_URL` are supplied. No production synthetic Orders are permitted.

Catalog/protocol references: [OpenRouter tool calling](https://openrouter.ai/docs/guides/features/tool-calling), [PoYo Responses](https://docs.poyo.ai/api-manual/chat-series/responses), [PoYo capability catalog](https://docs.poyo.ai/integrations/capability-catalog.json).

## Boundaries and operation

The model receives compact state, bounded recent history, public business facts and 12 native typed tools. It has no Prisma/SQL/HTTP/admin/finance tools. The server enforces conversation identity, strict Zod arguments, mode, active job lease, revision, quote and rule versions, verified addresses, scoped expiring slots, crew locks, fresh route cache and explicit recap confirmation. A selected time alone never authorizes an Order. A phone claim cannot expose or merge an existing Client; the owner can bind an independently verified client during HUMAN_CONTROL. Returning clients can read their own addresses and reschedule only their conversation's linked confirmed/scheduled Order.

SHADOW stores proposed state/answer/operational plan separately, sends no AI reply and creates no Client/Lead/Order/Handoff. Owner replies always use the same channel. Telemetry stores token counts, cost estimates and safe error codes, without prompts or reasoning. Audit is append-only and identifies AI actors. Partial/uncertain business commit stops the turn and requires reconciliation; model fallback runs only before tool execution.

Messages/jobs are committed before acknowledgement. On Vercel, an opaque wake-up is published to a private [Vercel Queues consumer](https://vercel.com/docs/queues/quickstart). Re-delivery uses the same durable job and checks leases and completed side effects. Failed provider turns hand off rather than repeatedly booking. The daily authenticated recovery cron republishes pending/expired work; Website polling and owner retry also recover jobs. Local `next start` uses `after()` against the same persisted jobs. Telegram sends with an unknown outcome are marked UNKNOWN and never retried automatically, because Bot API sendMessage has no idempotency key. Verify the channel before sending a replacement manually.

## Owner configuration

Release verification: 69 targeted agent/security/provider/HTTP/migration tests passed, plus 62 existing scheduling/routing/finance regression tests. Lint, typecheck and production build passed. Chrome checked Website Chat and Inbox on desktop/390px, saved history and manual reply delivery. Preview's real private queue completed native RU/SR Latin/SR Cyrillic/EN FAQ turns without chat polling. A real multi-turn quote returned the domain total (60 m² regular = 5,700 RSD); a duration request with no active owner rule handed off. Synthetic Preview conversations created no Orders. Production migration preserved operational records and defaults to SHADOW.

Post-benchmark live verification found Responses normalization making optional contact fields mandatory. Production explicitly sets native function `strict:false` to preserve their optional status; strict Zod/scope/business validation remains server-side. A fresh real SHADOW turn then omitted unknown contacts and asked only two qualification questions. Benchmark scores above describe the original catalog comparison, not a re-run after this protocol fix. Explicit owner retry advances the conversation revision so queue deduplication cannot suppress the new attempt. See the [Responses function-calling defaults](https://developers.openai.com/api/docs/guides/function-calling).

- Create reliable active DurationRule versions, complete cleaner availability/home locations and set `GOOGLE_MAPS_SERVER_API_KEY` for actual Places/routing. Missing rules or unverified routes produce handoff; guessed rules are never activated.
- Customer Telegram is **disabled-ready** until separate `TELEGRAM_CUSTOMER_BOT_TOKEN` and `TELEGRAM_CUSTOMER_WEBHOOK_SECRET` are present. The internal notifications bot is never reused. Using the official Bot API `setWebhook`, register `https://lumacleanrs.com/api/channels/telegram`, with `secret_token` equal to the server webhook secret and `allowed_updates=["message"]`. Use secret-safe stdin/API tooling, never a token in shared logs or screenshots. Private text updates are deduplicated; groups/photos/service messages are acknowledged and ignored.
- WhatsApp/Viber have normalized official adapter interfaces and disabled implementations; they await their respective official Business API credentials.
- Review SHADOW proposals, test exception/booking flows, then explicitly choose AUTO and confirm the checkbox in Inbox/Settings. Keep production SHADOW until that review is complete. Provider/model/rates and daily budget are environment configuration, not agent business logic.
