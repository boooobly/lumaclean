# Conversation reliability — incident and pipeline audit

## Production evidence before changes, 14 October 2026

Read-only lookup matched exactly one conversation containing the supplied appliance message. No production conversation was changed. Reported turn/job numbers are local aliases; IDs, contact details and addresses are excluded. AgentToolTrace currently stores tool names/outcomes, not payloads or full per-turn state, so it cannot prove the model's exact rejected arguments.

| Point | Persisted evidence | Consequence |
|---|---|---|
| Client turn 4 (Message 7) names fridge and oven | Message inputIntent = EXTRAS; preceding AI reply intent = EXTRAS, mentioning inside cleaning | Context is available but extraction ignores appliance scope. |
| Job 4 | recordCustomerFacts → CUSTOMER_FACTS_REQUIRED; requestCustomerInput → OK | Model fact proposal cannot enter authoritative state. |
| After normal soil answer | Next AI reply intent = EXTRAS | Previously named appliances are still treated as unknown. |
| Client says already answered | Empty continuation reply with EXTRAS reply intent | No recovery from a repeated unanswered question. |
| Job 7, repeated appliance request | Three rejected recordCustomerFacts calls and rejected calculatePrice; EXTRAS asked again | Tool argument correction cannot overcome evidence parser limitations. |
| Latest state | regular, 88 m², NORMAL; no extras/extrasConfirmed; nextInput EXTRAS | No quote exists. |
| Linked Lead | regular, 88 m², no extras, no estimated price | CRM preserves only part of the cleaning request. |

PoYo succeeded on some calls but also timed out; OpenRouter fallback succeeded. These provider results do not explain the deterministic fact rejection and qualification loop. Existing output telemetry does not identify each rejected response condition.

## Reproduced causes

The exact supplied seven client messages are preserved in `tests/agent/conversation-golden.test.ts`. Before code changes both tests FAIL: the first appliance answer extracts an empty list, and the approved per-appliance pricing assertion finds 900/1100 instead of 1000/1000. The original total happens to remain 9200; checking only total would hide the tariff discrepancy.

1. `explicitCustomerFacts` chooses oven OR fridge using a ternary, rather than collecting all entities. It also requires selected literal phrasings and does not inherit the confirmed inside-appliance question scope.
2. `supportedFacts` requires exact equality against that same narrow parser. A correct model proposal may therefore be rejected. Existing trace cannot establish the actual proposal, but the exact unit reproduction establishes the parser failure.
3. `conversionIntake` may return a generic previous-question acknowledgement without incorporating or repairing the answer. There is no durable question attempt/progress tracker.
4. `applyCustomerFacts` clears slots, pending confirmation and requestedWindow for every change, including unrelated contact changes. This can lose time preferences unnecessarily.
5. `updateLead` does not sync confirmed extras. Conversation→Lead continuity is incomplete.
6. `quoteText` localizes only window labels and exposes other internal extra codes.
7. A direct price question exits deterministic intake even when facts could be completed or a pending price request should be answered on the next turn.

## Pricing evidence and authorization

Production ServiceExtra and source agree on the old fridge=900 / oven=1100 prices; four other appliance types are absent. The user explicitly requests the owner-approved 1000 per unit tariff and instructed the implementer to choose the six appliance types. Chosen: fridge, oven, microwave, hood, dishwasher, washingMachine. New item scope is accessible inside surfaces without disassembly or repairs. Existing financial snapshots must remain unchanged. No separate additional approval is inferred from old seeded prices alone; later conflicting owner edits must be checked before rollout.

## Pipeline audit and changes

| Stage / inputs | Finding and final handling | Evidence / boundary |
|---|---|---|
| Channel inbound / Website, Telegram, WhatsApp adapters | Existing deduplication, transport metadata and image persistence retained. Public transcript now returns an explicit metadata allowlist. Extraction/debug/source fields stay server-side. | Channel/attachment and HTTP ingress suites; no synthetic real-customer messages. |
| Message persistence / conversation lock, revision | Facts extracted once at ingress; accepted non-contact source facts and question intent saved with each CLIENT message. Duplicate request IDs do not re-apply quantities. | Exact persisted golden checks one reply and revision per request. |
| Burst grouping / currentClientTurn | Existing bounded unanswered CLIENT grouping retained. Model evidence must come from that turn; replay merges the final state after later burst corrections. | Existing continuity/domain tests; no use of unrelated/operator text as customer consent. |
| Intent / latest message | Direct price requests persist across the missing-soil question. Catalog questions do not silently replace area or service. Safety and unusual work still use existing policy/review boundaries. | Multilingual corpus and FAQ/hard-handoff regression. |
| Extraction / explicit text | Collect every appliance and quantity with Unicode entity boundaries; dishwasher does not also select washingMachine. Named negatives remove only named items; unquantified retained items preserve counts. | Four-language corpus, count/correction tests. |
| Context / saved question | Persist actual AI message reference, question key, scope, offered items, progress signature and attempts. EXTRAS inherits inside scope; unscoped appliance requests require scope confirmation. District acknowledgement keeps the original open question. | Golden plus district, scope and open-question tests. |
| Hybrid extraction / current-source native tools | One bounded, ordinarily metered extraction call for a meaningful unrecognized scoped answer; execute only recordCustomerFacts. Unsupported semantics need exact fieldEvidence and customer confirmation. Partial extraction cannot silently quote a truncated list. | Actual Preview tools: pending proposal blocks quote, foreign evidence and invented contact rejected, partial-list clarification. |
| Validation / schema and provenance | Operational allowlist; literal/source-bound numeric evidence, no financial/identity mutation, no image-derived area/soil. Explicit corrections supersede pending speculation. | Proposal/security corpus and database domain suite. |
| State merge / confirmed draft facts | Extras merge additively, specific declines remove specifically, generic no-more retains selected items. Changes clear dependent quote/duration/slots/recap; phone/name keep quote and requested time but invalidate recap. | Correction, stale confirmation and ten-turn state sequences. |
| Lead sync / current state | Save early cleaning intent; sync current confirmed LeadExtra quantities and server unit prices, current estimate and managed factual note. Converted Leads and historical Orders remain untouched. Lead tool cannot override confirmed service/area or invent contact. | Golden Lead=9200 with two 1000 snapshots; actual rejection tests. |
| Next action / complete known fields | Answer price when possible, ask only missing fields, retain pending price intent durably. A service uncertainty takes priority over extraction for an unrelated open window question. | Golden and pre-existing conversion incident regression. |
| Loop recovery / question attempts and complaint | Replay only missing operational fields from bounded same-conversation CLIENT history; preserve explicit corrections and already removed extras. If unresolved, ask a narrow clarification and block quote/booking. | Recovery unit/domain tests; no general empty continuation. |
| Tools / leases, budget, errors | Shared metered provider wrapper across extraction, main reasoning and text repair. Existing quota/deadline/control/idempotency guards retained. Catalog mismatch requires review; failed calculation does not falsely set QUOTING. | Existing provider, recovery, takeover and safety suites. |
| Pricing / active catalog and server engine | Six inside-appliance codes at 1000 each; public/Admin quantity controls, localized labels, prospective data migrations. Refuse selected active price disagreement. Final booking compares per-unit breakdown too, even if total is unchanged. | Two failing before tests; golden base7200+1000+1000; six-item catalog database check. |
| Price comparisons / earlier snapshots | A question about price without an appliance runs a source-bound read-only calculation and preserves selected services, Lead, quote and confirmation. Actual removal remains a correction. Quotes older than 30 minutes or using old per-unit prices are recalculated before answering a price request. | Actual domain alternative 8200 preserves current 9200 quote; old 900+1100 snapshot rejected for reuse even though total remains 9200. |
| Duration / address / slots | Existing rules, unknown-extra reserve, every-cleaner routing, verified address, cutoff17:00, same-day20% and final slot check retained. No guessed minutes or coordinates. | Actual NO_SLOTS, stale slot and temporal tests; native booking proof independent. |
| Response / output validation | Localized all appliance prices and Serbian Cyrillic quote labels. FAQ price whitelist includes only active matching catalog amounts. Unknown presence/key protocol answered honestly. Existing amount/booking/slot guard and one text-only repair retained. | Corpus and native replay required; unsupported responses never sent as claims. |
| Final persistence / delivery | Existing durable job/one-response/outbox flow. Pure qualification question no longer marked a useful consultation merely because getBusinessInfo ran. | Golden, duplicate-reply and channel suites. |
| Admin / observability | Ten bounded reliability counters persist in Conversation.state, with field names and last tool outcomes. 7/30-day aggregation and per-dialog decision detail are hidden in technical disclosures. Synthetic namespaces excluded from analytics. | No client text/contact in diagnostic counters; old missing counters mean unavailable history, not zero errors. |

## Verified intermediate results

The identical seven-message persisted test fails on exact main f884fea at the first appliance answer and passes after the fixes. It uses a controlled native-shaped provider with actual Preview database, jobs and domain tools: regular/88/NORMAL, fridge1+oven1, automatic server quote9200, matching LeadExtra snapshots, one EXTRAS question, no hard handoff, no Order, duplicate ingress produces no duplicate reply. This is not a live PoYo/OpenRouter claim.

Production read-only price audit: 19 Orders including 14 historical; zero OrderExtra rows; no ServiceExtra owner-edit audit entries. Numeric financial digests are saved privately for comparison across the authorized prospective catalog rollout. The first Preview migration changes prices/adds four items; the second aligns the two old `service` units to `item`. Neither updates Order/financial snapshots. The old 900+1100 total equals the new 1000+1000 total, so a sum-only assertion would miss the error.

Ordinary unsupported wording remains a candidate until customer confirms; unpublished access/presence rules are not invented. Furniture booking remains review-only. Live providers, final release checks and production readiness remain separate required gates; provider outages are INCONCLUSIVE. Production modes remain WebsiteAUTO / WhatsAppAUTO / TelegramOFF / ViberOFF.

## Qualification scope and remaining business constraints

Service, area, dirt, all six appliances, windows, exact date and contact use confirmed state with correction/invalidation coverage. Separate stated toilets and bathrooms are collected together in all four languages. No additional-bathroom price or bathroom coefficient is configured in the existing price matrix/Duration Rules; the count is retained in the Lead factual note, with no invented surcharge or minutes. Window type/quantity remains mandatory before complete pricing. Crew preference is retained separately from the actual configured required crew. Neighborhood is a hint, never coordinates or service-area proof. Relative dates use the attributed message time; vague time-of-day still requires an exact interval before slot search. Urgency is derived by server date policy, not the model's boolean.

Balcony, cabinets, ironing, linen/pet-hair/steam and other complex wording use the existing catalog and bounded source proposals when deterministic extraction is insufficient. Quantities must be confirmed; no invented cabinet counts or conversions from ambiguous laundry requests. The pre-existing ironing catalog exposes 900 per 30 minutes publicly while legacy CRM metadata labels the unit as hours; this task does not reinterpret historical quantities or change that unrelated tariff. Ambiguous ironing/laundry quantities need narrow confirmation/review. Recurring service can be discussed, but an unsupported recurring booking workflow is not synthesized. Existing incomplete Duration Rules (including appliance combinations) require targeted duration review before booking; no minutes are fabricated to raise automation statistics.

## Verification and final source

Final runtime source: `99b41f0b0d5d8c6f9e12166b08a669cdaece45bf1cfb33a22c318f8335b3c837`, Preview `lumaclean-hg70pmgvi-vladislavs-projects-0eae0ea3.vercel.app`.

703 passing checks in the release evidence: 611 agent unit checks; 67 admin/CRM/finance/scheduling checks; exact persisted golden; 10 new persisted domain checks; 4 conversion checks; 10 continuity checks. 15 database-dependent agent tests and 8 other database tests are skipped in the unit invocation; relevant Preview checks run separately. The independent new multilingual corpus has 250/250 passing checks including four ten-turn state sequences. Real continuity covers >12-message history, takeover/resume, operator and typed corrections, rapid bursts, duplicate ingress, photos and stale work. One actual HTTP concurrency fixture is unavailable in that run and stays SKIP.

Routing: 68 PASS, 2 FAIL, 2 SKIP. The same two Google opt-in assertions fail on the unchanged exact `f884fea` baseline; they are excluded from the passing release count. TypeScript/build PASS, ESLint has zero errors and two pre-existing image warnings in unchanged website-chat.tsx. No new dependency or unbounded prompt growth.

Identical baseline golden: before first appliance reply loses both items and CRM has no quote; after fridge1+oven1 retained, single EXTRAS question, server quote9200 and matching two1000 LeadExtra snapshots. Original main's 900+1100 rates are replaced prospectively; no historical financial snapshots rewritten. Native testing exposed an additional false-positive `move` inside `Remove`, now bounded as a whole verb; real heavy moving remains protected. Zero-quantity model placeholders no longer pollute selected extras. HUMAN reconciliation uses accepted source snapshots to avoid applying an additional count twice, and a service uncertainty is handled before extraction against an unrelated open question.

Browser: six RU/SR/EN mobile/desktop calculator checks PASS (7200 base, 10200 with two fridges plus oven, 14200 with the remaining four appliances), no horizontal overflow, one upholstery checkbox retained. Admin known facts, saved EXTRAS inside scope, decision disclosure and 7/30 reliability analytics verified on a strictly owned Preview fixture. The fixture was cleaned and the temporary browser session revoked. A temporary Preview session cookie accidentally appeared in an internal tool output; its session was immediately revoked and temporary files removed. The saved owner password was not printed or published.

Final-source PoYo native golden: 7/7 turns PASS with no fallback; safe booking simulation: all8 steps PASS with PoYo only, synthetic Order cleaned and signed source-bound proof available privately. OpenRouter EN:13/13 PASS including remove/re-add and read-only alternate quote; RU:10/10 PASS including customer-confirmed natural soil wording; Serbian Cyrillic:10/10 PASS. All owned native fixtures cleaned. Earlier timeout/fallback runs remain explicitly INCONCLUSIVE and are not mixed into final-source passing counts. Two previously failing catalog FAQs now pass on actual Preview tools: appliance-ru DOMAIN_PASS (no model call needed), language-switch-ru native PASS. No production 95% claim is supported by this synthetic sample.

Hard safeguards retained: customer-requested operator, serious complaint/damage/compensation, actual hazardous/heavy work, identity/access violation, unsupported real cancellation and unrecoverable operation/limit failures. Soft reviews are deduplicated, retain AI control and block booking until the necessary resolution. Unknown business conditions, prices, routes and durations are not promised. Release/main/deployment/readiness results are recorded after rollout in a separate private result file.
