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
