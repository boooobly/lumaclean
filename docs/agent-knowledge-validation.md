# Nina business knowledge — validation record

Approved source: live Google Sheet, tabs 01–06; modified 2026-10-17 20:01:55 UTC. Catalog version `2026-10-17.4ede733b908e`. Audit, source interpretation, refresh procedure and rollback: [agent-business-knowledge.md](agent-business-knowledge.md).

The old agent lacked most extras, mattresses, carpets and operating rules. Cash-only canned FAQ, Serbian inclusion/key confusion, qualification-before-answer, incomplete bathroom quotes and unnecessary renovation/quality-policy handoffs were corrected. The new catalog has 379 service/pricing positions: 162 OFFERED, 127 BY_AGREEMENT, 90 UNAVAILABLE; plus 108 scope operations and 39 public rules, 526 records total. These counts are knowledge records, not new independently bookable CRM services. Only the existing permitted regular/deep workflow can book autonomously.

Read-only indexed retrieval returns at most five relevant records, with a bounded payload and RU/SR/EN aliases. It uses one generated versioned snapshot, never live Sheets per response. Private financial/labour columns and tabs 07–12 are excluded. Runtime/database tariff mismatches stop retrieval with `PRICE_CATALOG_MISMATCH`. Informational amounts must match retrieved facts; order totals still require the shared server calculator. Catalog status does not grant booking permission. Custom work and upholstery save a Lead and specific review while consultation continues. Additional bathrooms block an incomplete final quote/booking. All existing identity, channel, job, history and confirmation controls remain.

971 checks pass: 892 agent/admin/CRM/finance/scheduling checks plus 79 actual pricing/knowledge database checks. The final 18 knowledge-tool integration checks were repeated after guard changes, without double-counting them. There are 25 environment-dependent skips in the broad suite; actual database checks ran separately on the existing isolated branch. The knowledge suite includes 132 multilingual retrieval cases and real multi-turn native scenarios. TypeScript and build pass. Source ESLint has zero errors and two pre-existing next/image warnings in website-chat.tsx. No schema/migration, public price, calculator UI, model/provider, persistent channel-mode or financial-history change is included.

Native Preview used fixed synthetic clients, authenticated existing providers, real shared ingress/jobs/tools/Lead persistence and owned fixture cleanup. Golden A returns server 16,600 RSD. Golden B retains two bathrooms, shows known subtotal 8,200 and separate approved 1,200, requires review and does not book. Golden C retains a Lead, sofa starting at 4,600, standalone minimum 4,000 as a floor, never a second fee. Renovation/mold are refused, card is unconfirmed, Airbnb linen is separate 750 per bed. Shutters are not substituted with windows. Real configured fallback passed 14 RU/SR/EN turns without provider/tool errors, recovery, hard handoff or booking. WhatsApp uses controlled no-network outbound adapters and synthetic delivery receipts; this verifies shared AI/adapter logic, not real Meta delivery. No real customer WhatsApp messages or production test Orders are used.

Paired benchmark: eight conversations, the same 27 turns before and after implementation, primary provider and existing budgets. Raw aggregate records are [baseline](agent-knowledge-baseline.json) and [after](agent-knowledge-measurements.json). Timing was measured at `a33fbdf`; later native QA corrections were separately retested, not retroactively included in those numbers.

| Metric | Before | After |
|---|---:|---:|
| Full-response p50 | 9,524 ms | 6,493 ms |
| Full-response p95 | 21,018 ms | 21,120 ms |
| LLM calls | 44 | 30 |
| Input/output tokens | 544,468 / 1,839 | 320,235 / 2,204 |
| Estimated cost, eight conversations | $0.04429304 | $0.02650040 |
| Estimated cost per conversation | $0.00554 | $0.00331 |
| Knowledge lookups / repeated lookups | 19 / 12 | 24 / 0 |
| Tool errors / provider errors | 4 / 0 | 0 / 0 |
| Unnecessary hard handoffs | 2 | 0 |

Costs are configured token-price estimates, not invoices. The small paired benchmark shows lower median/cost and essentially unchanged p95; it does not establish the 95% business target. Subsequent runs experienced transient PoYo network timeouts and higher latency; the unchanged OpenRouter fallback recovered. A repeated three-turn WhatsApp EN run completed entirely on primary with zero provider errors, with p50 19,484 ms and p95 35,653 ms. Failed/inconclusive attempts are not counted as successful primary verification.

The final source-bound native booking test passed all eight steps with PoYo: qualification, server price, duration, address, route, slot, slot revalidation and explicit-confirmation Order creation. Its 50 m² regular quote was 6,000 RSD, with 150 minutes plus 30 minutes cleaning reserve, two assigned cleaners and the unchanged 30-minute transport buffer. The entire owned Preview batch was cleaned. The signed proof is bound to source fingerprint `469522032dbf09ed7ceb843830dda1f232e57a1e7c20c6dd5f2aae63132faefe`; no production test Order was created.

Native sign-off covers 48 primary-preferred consultation turns and 14 explicitly selected fallback turns. The unchanged cases were measured at `a33fbdf`; shutter/request corrections at `2f2b9bb`; English WhatsApp at `c928a7a`; final rules and source-bound booking at `5c5c26e`. Catalog version is identical throughout. Earlier failed iterations are excluded from successful sign-off and documented above; a primary timeout recovered by fallback remains INCONCLUSIVE for a primary-only assertion until a clean repeat. No hard handoff, guard recovery, booking or owned-fixture leak occurred in the accepted consultation runs. Website/WhatsApp share one knowledge layer; external WhatsApp delivery remains simulated.

PR, merge, production deployment, proof import, fresh readiness and finance/channel-mode comparison are recorded in the release PR after execution. This document does not claim a production deployment before those steps complete.
