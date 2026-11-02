# Website AI activation — 2 November 2026

Scope: enable full WEBSITE AI only after genuine readiness. Existing operator, Queue and CRM are reused. Other messenger AI channels remain OFF. Production is still `b9a16f69` / `dpl_BoZRwQkeGhZawFUFgedrCQDqYWCe`; no activation changes have been deployed.

Working branch: `codex/website-ai-activation-20261102`. Commit `6483c3f` contains the reviewed audit source-admission fix and isolated test reconciliation. Commit `a915649` contains tested final-rounding/quantity corrections. Neither has been deployed.

## Initial evidence and failures (historical within this task)

- Production read-only: global mode OFF, WEBSITE ceiling AUTO, other channels OFF; promoted runtime/build flag false. Primary/fallback/Places diagnostics reported success on 1 November23:37UTC, MOTIS WALKING/degraded. These stored diagnostics are not a new native test.
- Stored signed proof dates from25October19:02UTC: expired. A source/config-bound native proof must be regenerated in isolated Preview; none has been generated in this work.
- Active regular rule:1–100m²,150elapsed minutes; deep40–60m²,480minutes; oven30minutes. These conflict with owner-confirmed normal50m²/two-person120/360minutes and oven45person-minutes. No production rules have been changed.
- Isolated PG18:127.0.0.1:55461, `lumaclean_ai_test`, exact checkout-owned cluster directory verified before writes, fresh schema/seed,25migrations and zero schema drift. Existing synthetic databases are renamed/preserved, never dropped.
- Autonomous integration57/57 PASS ISOLATED/MOCKED. Admission/channel/limit group40/40 PASS (overlaps full unit coverage). No native provider/Telegram calls.
- First gate-only full unit run1050PASS/0FAIL/34environmentSKIP; typecheck/lint/build/Prisma validation PASS. An initial typecheck included archived source under artifacts; excluding that generated artifact directory fixed it while src/tests remain included.
- Pricing oracle reproduced6750vs6800 and13050vs13100 (2FAIL). Reviewed audit rounding fix makes both PASS. Crypto choice tests2/2PASS. Broader pricing regression currently has3old-expectation FAIL to reconcile against the owner-approved final-ceiling rule; no green result claimed yet.
- No source certificate has been marked AI-ready, no native/live result has been substituted with synthetic readiness, no production flags or records have been changed.

## Owner-approved area scope and duration model

The owner explicitly requested coverage25–180m² and manual agreement above120m². This area boundary is implemented in pricing review, duration/slot preparation and fresh booking revalidation. An existing/unchecked quote cannot bypass it. Historical booked results remain idempotent; manual CRM planning is unchanged.

On2November the owner explicitly confirmed the proportional model through120m². This is an approved calculation, not measured work or an active production rule. Normal soil, no extras, exactly two workers; elapsed time rounded up to5minutes. Existing calendar/travel reserves remain separate. Orders must fit the actual crew schedule; no invented overtime or multi-day promise.

| Area | Regular elapsed | Regular person-minutes | Deep elapsed | Deep person-minutes |
|---|---:|---:|---:|---:|
|25m²|1h00|120|3h00|360|
|40m²|1h40|200|4h50|580|
|50m² — confirmed anchor|2h00|240|6h00|720|
|60m²|2h25|290|7h15|870|
|80m²|3h15|390|9h40|1160|
|100m²|4h00|480|12h00|1440|
|120m²|4h50|580|14h25|1730|
|Above120–180m²|Manual agreement|Not inferred|Manual agreement|Not inferred|

Approved model for25–120m²: regular60minutes at25m² plus2.4minutes/m²; deep180minutes at25m² plus7.2minutes/m². Heavy/extreme/light factors, extra parallelism and other crew sizes are not inferred. Oven45person-minutes is already confirmed; its effect on elapsed order duration with a two-person crew remains separate from the no-extras scope. The inactive prospective data factory is `src/lib/services/approved-duration-rules.ts`; calculation uses the existing duration engine. Unknown extras have no scheduling reserve and cannot be booked automatically.

| Requested area band | Regular elapsed | Deep elapsed | Booking treatment |
|---|---|---|---|
|25–39.99m²|1h00–1h40|3h00–4h50|Only after versioned rule application and real slot checks|
|40–59.99m²|1h40–2h25|4h50–7h15|Same|
|60–79.99m²|2h25–3h15|7h15–9h40|Same|
|80–99.99m²|3h15–4h00|9h40–12h00|Same|
|100–120m²|4h00–4h50|12h00–14h25|Same; long jobs may not fit any real working window|
|Above120–180m²|By agreement|By agreement|Preliminary quote only; manual confirmation|

Bands are a presentation of one continuous formula. The eventual DB rule must cover25–120without overlaps or artificial gaps for decimal areas; it must not introduce a second duration mechanism.

Preserve historical rule references, order durations, prices and finance snapshots when applying prospective versions. No production rule has been changed. Existing administrative starter templates still describe historical150/480-minute rules; they must not be used to apply this new model. Deployment preparation must use reviewed versioned data and reject unapproved soil/extras instead of inheriting template coefficients.

## Continuation verification, 2 November

- Reconfirmed through Vercel connector: production remains READY at `dpl_BoZRwQkeGhZawFUFgedrCQDqYWCe`, source `b9a16f69a669b064884df96d1c688013bf6b7b5b`. No AI-task deployment or production writes.
- Latest full unit/domain run: **1069 PASS,0 FAIL,34 SKIP**. Skips remain environment-dependent, not PASS. Log: ignored `artifacts/website-ai-activation-20261102/full.log`.
- Latest fresh PG18 autonomous integration: **59 PASS,0 FAIL,0 SKIP, ISOLATED/MOCKED**. Includes eight simultaneous health-maintenance calls with exactly one SQL admission, real booking concurrency, source/server/role/kill-switch negatives, area review and idempotency. Providers remain mocked. Log: `integration.log` under the same ignored root.
- Existing cloud DB read-only preflight at15:36UTC: PG18.6, expected restricted runtime role/host/database;0clients,0orders,0conversations,0messages,0staff,10retained earlier synthetic Leads; all AI modes OFF. No staff copied, native calls0. This verifies only DB identity/counts, not a new deployed Preview or inherited-secret isolation.
- Actual local HTTP/PG authenticated CRM, admin, routing and scheduling: **40 PASS,0 FAIL,0 SKIP**, current build, separate synthetic admin database. Earlier scoped finance15/reliability22/recovery7 also passed in this activation workspace; their logs identify their own run and must not be represented as newly rerun by the59/1069 suites.
- TypeScript, Next production build, Prisma validation and ESLint passed in this work; final lint has0errors and2existing image warnings. Fresh AI DB replay:25migrations, zero schema drift. Production migration checksum reconciliation is not implied.
- Price final-ceiling regression and independent source contract are now green within full suite. Former3expectation failures were reconciled against the approved single final rounding; no tariff amounts were invented. RU/SR/EN UI reports cover13mocked form scenario groups and30upholstery layouts; no external delivery was inferred.
- One new test initially failed before reaching application code because Fetch rejects Cyrillic header characters. Corrected the invalid test header to a permitted Latin-1 byte; retained the failed run as `full-header-fixture-failure.log`, then reran the complete suite above. Production authorization was not weakened.

## Hourly diagnostics expiry and bounded maintenance

Readiness diagnostics expire after1hour. Without refresh, booking fails closed after that period even with AUTO set. Prepared `/api/agent/health`, GET every30minutes, constant-time existing `CRON_SECRET`, private/no-store and503on provider/DB failure. It does not drain jobs, send messages, mutate orders or renew signed booking proof.

The production-only nonsecret flag `AI_READINESS_CRON_ENABLED` defaults OFF. Server admission, source admission, global AUTO and WEBSITE AUTO are also required before any probe. A fixed atomic RateLimit row permits at most one attempt per half-hour across concurrent workers; crashes consume that attempt rather than trigger unbounded retries. Fresh matching diagnostics skip work. Calls reserve against the existing daily AI budget through `callBudget`; no parallel spend ledger or Team budget change.

Each maintenance attempt permits at most2Luna model requests,4096UTF-8-body bytes each,1200output tokens each,8MOTIS HTTP requests and0Google requests. Scope guards count before transport and remain active for cached provider instances. Swallowed budget failures cannot yield success. Thus at most96LLM/384MOTIS requests per day while AUTO is enabled. `healthCron` is an additional production readiness requirement. This configuration is prepared locally only, not enabled or cloud-proved.

Conservative model-cost estimate: under$4/month for these maintenance ceilings at current [PoYo](https://poyo.ai/models/gpt-6-luna) and [OpenRouter](https://openrouter.ai/openai/gpt-6-luna) tariffs, checked2November. Existing Vercel/Neon/routing usage and normal customer conversations are separate. This is an estimate, not a provider billing cap. The daily AI budget remains the hard application spending gate.

Signed booking proof still expires after7days, independently of diagnostics. This change neither renews it nor bypasses configuration/source/HMAC validation. Renew with an explicitly approved native Preview procedure before expiry; otherwise bookings fail closed.

## Pending bounded native plan

Owner authorized the bounded plan on2November and explicitly authorized recurring diagnostics within the stated limits. Production stage/promotion remain separate actions.

1. Reuse protected release-candidate project and isolated PG18 host `ep-icy-smoke-b8pu84zj.c-14.us-east-1.aws.neon.tech`, branch `br-rough-bread-b8y7ehd6`, DB `lumaclean_vercel_pro_20261101`, restricted runtime role `lumaclean_pro_runtime_20261101`. Recheck identities and customer-data absence before any write. No new paid resource.
2. To produce a configuration-bound proof transferable to production, temporarily mirror only the two operational staff names/workphones/start locations/availability into this protected DB, only if separately approved. No real clients/orders/messages; cleanup the owned staff copy after proof, retaining only hashes/counts in reports. Synthetic staff alone cannot honestly certify production's different configuration.
3. One diagnostics and two native bookings (regular/deep50m²), each with namespace-checked cleanup. Enforced aggregate maximum6LLM,72MOTIS HTTP,0Google,0Telegram; proposed spend allowance$1. Public test address and synthetic customer contacts only. No production Orders. Persist actual FAIL/cleanup results; stop at cap instead of automatically retrying.
4. Software source evidence regenerated with the existing source-verification procedure by `scripts/release-readiness/website-ai-source-evidence.mjs`: exact tested source `fbff1ffc…408b801`,1069unit/domain PASS,59isolated AI PASS,40HTTP/PG admin PASS and typecheck/lint/build/Prisma/replay evidence. `aiAutoReady:true` in this legacy file is the software admission required by `verifiedRelease`, not a native proof or permission for production AUTO. Profile explicitly says `WEBSITE_AI_SOURCE_TESTED_NATIVE_PENDING`, `nativeBookingVerified:false`, `productionReady:false`. No runtime gate was removed. Preview remains SHADOW; genuine diagnostics, native booking/config/HMAC proof and explicit activation remain independent requirements.
6. Existing cloud DB prepared using runtime role:2temporary staff,14availability rows,2approved NORMAL/no-extras duration rules;0customers/orders/messages copied. Production connection used READ ONLY. Owned IDs and original Preview settings retained only in ignored private receipt for exact cleanup. No native calls yet at this preparation point.
5. After genuine native proof, separately review exact source/config compatibility, prospective production DurationRule versions, HMAC validity, staged deployment, promotion and activation. Stable rollback target for this task is the currently serving manual deployment `dpl_BoZRwQkeGhZawFUFgedrCQDqYWCe`; preserve all new business records, disable AI first on regression.

## Actual protected native attempt — blocked, safely cleaned

Preview `dpl_33JVzJNTGbi6MxY1L4bGRMA9r82o`, source `91eb55e8c32edc248548a85f2fce33ac5a9517dd`, reached READY. [Protected deployment](https://lumaclean-release-candidate-3s91pxle2.vercel.app). RU/SR/EN returned200; synthetic admin login passed. New health endpoint rejected missing bearer with401 and returned explicit SKIP/DISABLED with valid bearer in Preview. Messaging, Blob, direct Google, ElevenLabs and production analytics were blanked in both build/runtime overrides. Actual database was the verified isolated PG18 runtime target, global SHADOW during test.

Exactly one owner-authorized diagnostics invocation at15:50:24UTC (16:50client time) performed native requests. Primary PoYo passed; OpenRouter fallback returned **PROVIDER_HTTP_401**. Address search via MOTIS passed. Routing passed only with **WALKING/degraded80-minute fallback**, not live transit. Actual runtime `native_test_budget` log confirms2LLM,3MOTIS,0Google; scope not exceeded. No automatic retry.

Mandatory fallback readiness therefore blocks native booking. Neither of the two bookings was attempted. No signed proof was generated. No client/order/conversation/message remained;0Telegram messages,0production writes. The result is FAIL/BLOCKED, not a native booking PASS.

Cleanup verified at15:51:56UTC: exactly2owned mirrored staff and14availability rows plus2owned temporary duration rules removed; original Preview scheduling/AI settings restored, all modes OFF. Earlier10synthetic Leads preserved. Temporary one-hour Vercel share link explicitly revoked. Deployed Preview remains protected; it has no active duration rules/staff for booking and global AI OFF. Production reconfirmed READY and unchanged at `b9a16f69`.

Sanitized committed evidence: `release/website-ai-native-20261102.json`. Full provider response codes, request journal, runtime log and cleanup receipt remain ignored/private. No credentials or staff identities appear in this report.

The owner must repair **OPENROUTER_API_KEY, Preview scope, project lumaclean-release-candidate** through protected Vercel settings. Do not send the value in chat. Existing sensitive credentials are masked by Vercel, so they cannot be safely repaired from local code. Do not change providers, drop fallback requirements or copy masked production credentials to obtain green checks.

After credential repair a new Preview must inherit the new value. Reconcile the bounded allowance before another diagnostics invocation:2of6LLM and3of72MOTIS requests have already been consumed. The remaining allowance is not permission for unbounded reruns. Both native bookings, source/config-bound HMAC proof, approved prospective production rule application and separately authorized production rollout remain pending. Production AI remains OFF.

## Owner-supplied credential repair and remaining allowance

Owner supplied a new credential in a specifically identified local file. It was read in memory and applied through the official Vercel API to the single existing **Preview-only** Sensitive `OPENROUTER_API_KEY` in `lumaclean-release-candidate`; no production variable changed, no credential printed or committed. A first PATCH including an unchanged key name was rejected by Vercel's Sensitive-variable rule; the value-only PATCH succeeded. No native API calls occurred during credential update.

Prepared a new Preview with lower-only scope ceilings: diagnostics routing5(previously8), booking LLM1(previously2). Limits cannot exceed their original profile maxima, and overrides apply only to Preview. With the prior2LLM/3MOTIS already consumed, one new diagnostics plus two single-call bookings cannot exceed the original total6LLM/72MOTIS allowance. If primary or a route needs more than the remaining per-test limit, stop and report FAIL; no automatic retries or fallback-gate weakening.

Source after this bounded retry guard: `9130991dcac2136dc3e5fdab8cea3f3e6155888904cb69a09a558801fbdc7486`. Fresh regression1070PASS/0FAIL/34SKIP; fresh isolated AI59PASS/0FAIL/0SKIP; production build and TypeScript PASS. ESLint result is separately recorded when complete. Native booking proof is still pending at this point. Existing admin40HTTP/PG result predates this lower-only transport change and is not represented as newly rerun.

### Actual second attempt and qualification mismatch

New protected Preview `dpl_Hi7TBj6DEqLV6pfVCMgkPwbjGSwY` / `7c10b28` reached READY and used the repaired key. Real diagnostics: OpenRouter PASS (401 resolved), PoYo FAIL/PROVIDER_TIMEOUT_OR_NETWORK, MOTIS address PASS, routing WALKING/degraded. Existing Preview gate permits proving the real fallback path, while full production AUTO still requires both model checks. Native requests: diagnostics2LLM/3MOTIS.

Regular native booking attempted once. PoYo emitted a valid calculatePrice call but its facts did not equal the explicit synthetic request: **NATIVE_QUALIFICATION_FACTS_MISMATCH**. Exact changed fields were not recorded by that source; no unsupported root cause is claimed. The requested one-call retry ceiling blocked the fallback before network transport. The generic HTTP400 is not evidence of fallback credential failure: DB batch and runtime scope log prove the fallback request was **not sent**. Batch statusFAILED, cleanuptrue, no Order created. Deep booking NOT RUN.

Aggregate across both attempts: **5LLM,6MOTIS,0Google,0Telegram**. One of the original6LLM remains, insufficient to repeat mandatory diagnostics and both bookings. Original$1 monetary ceiling remains unchanged. Further native calls are paused pending a concrete bounded request allowance; there are no unbounded retries.

Second fixture cleanup verified16:08UTC:2owned mirrored staff,14availability rows and2owned rules removed; original Preview settings restored OFF; prior10synthetic Leads preserved. Second temporary share link revoked. Production untouched.

Prepared diagnostic improvement only: a rejected native qualification logs **field names**, never field values, response text, tool arguments, staff details or secrets. It still throws the same mismatch error and keeps native fallback/booking guards. Local test reproduces changedarea/urgent and asserts the private values are absent from the log. Source `ff37b27b7936a8148908efaed1b61e1bcacc178449b7ea531415c61eece08f88`: full regression1071PASS/0FAIL/34SKIP, TypeScript/build/lint PASS (2existing image warnings). No new native pass was fabricated from this test.

Prepared next pass, requiring separate request-count consent: at most6additional LLM (2diagnostics, up to2regular, up to2deep) and72MOTIS, staying within the original$1 allowance. At most11LLM/78MOTIS cumulatively including actual prior attempts;0Google,0Telegram,0production Orders. Real fallback remains allowed within its original per-booking2-call ceiling. Stop on failed diagnostics, rejected facts, missing slot, cleanup failure or cap. No production stage/promotion or activation is included.

## Successful third native pass — production admission still pending

Owner authorized the bounded repeat. Protected deployment **`dpl_ECwhA2RjcNj8JKVv1icFtxdQjoj3`**, application source **`ce8e9b2939dd5c9743cca352d40aafca3f14c037`**, fingerprint **`ff37b27b7936a8148908efaed1b61e1bcacc178449b7ea531415c61eece08f88`**. [Preview](https://lumaclean-release-candidate-cjxxgk6st.vercel.app) remains Vercel-protected; temporary verification share was revoked after testing.

Real diagnostics at16:17UTC: primaryPoYo PASS, fallbackOpenRouter PASS, address searchMOTIS PASS, routingPASS in WALKING/degraded fallback mode. No live-transit claim. The prior primary timeout/mismatch remains in historical evidence; the new successful pass does not erase it.

| Native scenario | Price | Elapsed work | Cleaning reserve | Crew | Result |
|---|---:|---:|---:|---:|---|
|Regular50m²/NORMAL/noextras|6000RSD|120min|30min|2assigned|8of8steps PASS; signed proof; batch cleanup PASS|
|Deep50m²/NORMAL/noextras|11400RSD|360min|30min|2assigned|8of8steps PASS; signed proof; batch cleanup PASS|

Both prices match the independent approved pricing contract. Transport reserve remained separately30minutes. Native LLM qualification, shared server price/duration, real public address, route-backed slots, fresh slot revalidation, explicit test confirmation and actual isolated Order creation were exercised. This uses the project's synthetic live-booking workflow, not a customer-facing production conversation or an external Telegram delivery proof. No production Order was created. Both source/config-bound signed proofs were generated by deployed code only after verified cleanup; signatures stay private.

Runtime counts verified: diagnostics2LLM/3MOTIS; Regular1LLM/17MOTIS; Deep1LLM/13MOTIS. Latestpass4LLM/33MOTIS; aggregate9LLM/39MOTIS across all attempts, within the approved11/78 ceilings. Google0, Telegram0. No unapproved retries.

Actual clients/orders/conversations/messages after tests all0, original10synthetic Leads retained. At16:21UTC removed exactly the owned2staff/14availability rows and2temporary duration rules, restored original Preview settings/global OFF and revoked temporary share. These are verified logical row removals, not a claim about erasure from provider backup history. Append-only audit and safe native batch reports retained.

`scripts/release-readiness/website-ai-native-evidence.mjs` validates actual private reports, cleanup, source identity, snapshots, proof shape/age and request ceilings before updating public sanitized evidence and software admission. Profile now **WEBSITE_AI_PREVIEW_VERIFIED_PRODUCTION_PENDING**; `nativeBookingVerified:true` and `cloudPreviewCertified:true` refer to this isolated scope. **productionReady:false**. Compatibility with production's HMAC/env/configuration is not yet verified and must not be inferred from Preview PASS.

## Concrete staged production plan — not executed

Prepared `scripts/release-readiness/website-ai-stage.mjs`, syntax checked. It requires the owner's exact HEAD approval, clean Git tree, matching tested source/native evidence, valid fresh proof shape and production database global OFF. It archives only the approved tracked commit and checks build/postinstall do not migrate/seed.

The only deployment command is `vercel deploy <exact archive> --prod --skip-domain --project prj_Q4nkQeWNwBIFz1AsthDvyEeJ5BeZ`. No promotion or customer domains. It uses normal production credentials server-side plus deployment-only overrides `AI_AGENT_ENABLED=true`, `AI_READINESS_CRON_ENABLED=true` and the owner-provided repaired OpenRouter key. Project-level production environment variables are not changed. The currently serving deployment retains its original env; global DB mode stays OFF, so replies, AI jobs and health probes remain disabled. No diagnostics, native calls, valid submissions, migrations, seed, DurationRule edits or proof import occur during this stage command.

Owner approval for this exact staged build is still required. After it, read-only staged smoke must prove source/artifact identity, RU/SR/EN, API/auth protection, DB mode OFF and no unexpected Cron/AI activity. Then independently prepare/verify prospective production rules and source/config/HMAC proof admission. A currently expired/incompatible production proof cannot be overwritten with unchecked JSON.

Before any later activation: create approved new regular/deep DurationRule versions while retaining historical rows and snapshots; approved NORMAL-only/noextras25–120 scope, separate reserves; keep global OFF during configuration; validate the actual production HMAC/config/source; run approved fresh production diagnostics under a bounded allowance; ensure future project-level provider env agrees with the release; obtain separate promotion/activation approval. No employee/client/order data should be reset.

Rollback proposal for later explicit approval: switch global AI OFF with existing revision/outbox cancellation protections, then rollback artifact to stable manual `dpl_BoZRwQkeGhZawFUFgedrCQDqYWCe`. Preserve every new Lead/Order/notification and financial snapshot. Do not restore a DB backup or delete release-period records. If duration activation must be reverted, restore prior active IDs and keep new version rows for audit; do not rewrite existing Order durations.
