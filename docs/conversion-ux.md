# Homepage conversion redesign

## Baseline, 2026-10-18 (before changes)

- Main: 93e8e3d. Window pricing depends on PR #21 (700 / 1,000 RSD); this branch is stacked on that patch until it reaches main.
- Source audit: ApartmentExperience → JourneyHandoff → scope/directory/upholstery → rates → materials/14-item extras ledger → method → terms → FAQ → estimate → closing. The first interactive quote comes after six intervening commercial sections; desktop section padding reaches 170px. Mobile already uses a static, touch-friendly hero rather than desktop video scrubbing.
- Calculator initially exposes five service radios, ten quantity controls, four toggles, an urgency checkbox and a separate upholstery checkbox. Name is required on both client and server. Date is unstructured comment text. Success does not display the returned reference.
- Strengths retained: original apartment assets and before/after, passive scroll listeners, shared calculatePrice, localized copy, consent-gated analytics, validated phone, transactional submissionId lock and stored Lead line-price snapshots.
- Production database aggregate: 8 Website Leads in the preceding 28 days, 6 with attribution. No rows in the previous 28-day bucket. This is a count of stored Leads, not a conversion rate or a traffic measure; it may include earlier QA records. GA reporting credentials and field CWV measurements are not available in this task. No conversion uplift is claimed.
- Browser audit is blocked: local Chrome access is disabled in Work settings. Source observations above are not visual QA findings. Rate Cleaning attachment is not available in this conversation; the supplied structural brief is used without copying visual styling.

## Plan and rationale

Keep the branded apartment first screen with an immediate calculator jump. Put a single commercial form directly after the story: two primary service cards, secondary service selector, area and live estimate, short inclusion comparison, grouped optional extras, preferred date and contact. Put full price bands, SEO service links, process, terms and FAQ after it; collapse repetitive detailed ledgers rather than deleting information.

Keep the paper/ink/teal palette and Onest/Golos fonts. Use a calm side summary on desktop and an in-flow sticky estimate on mobile, with no fixed bottom overlay. Keep state mounted when extras close. Use a native accessible date picker; it requests a date, never asserts slot availability. Let the server determine same-day urgency in Belgrade. Store missing names as null and preferences in dedicated Lead columns, never Order scheduling fields.

Research: [NN/g, Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) recommends prioritizing common choices and clearly exposing specialized options on demand. [Baymard, Checkout UX](https://baymard.com/blog/checkout-flow-ux-optimization) focuses on reducing interaction cost and unnecessary fields. These principles guide the design; ecommerce results are not numerical forecasts for LumaClean.

## Measurement

Retain form_start, calculator_interaction, generate_lead, lead_error and messenger_click. Add calculator_open, service_select, price_view, extras_open, preferred_date_select and contact_start. Send only allowlisted locale/service/error/channel, date choice category and a fixed flow version, never actual date, size, price, contact or comment. Compare consented homepage sessions → price_view → contact_start → generate_lead over equal complete periods, segment locale/device/acquisition, exclude internal traffic. Existing event names remain usable across the release boundary; new funnel steps have no historical baseline. Compare error rates and field CWV separately. Do not claim causality from a small before/after sample.

## Release constraints

Preview only. No production merge, migration or deployment before owner visual approval. Preview browser screenshots, keyboard/touch, six requested viewport widths and actual Web Vitals must be recorded separately from unit/build evidence. A passing build is not visual acceptance.

## Implementation and verification

- One Estimate form, reused by existing service pages. Two primary cards; existing move/Airbnb/office under a secondary selector. Full price bands are a disclosure after the form, with synchronized service choice. The old duplicate comparison cards and 14-row decorative extras ledger were merged into the form's scope/extras; service links, materials, terms, method and FAQs remain. The desktop kitchen handoff is shortened, not removed.
- The form retains all quantities when disclosures close or the visitor switches to upholstery-only and back. No independent quote formula: calculatePrice supplies totals. Heavy soiling is explicitly an assessment request and stores estimatedPrice=null. Upholstery has no invented total.
- Native date picker, optional time category and contact preference. Server policy supplies the Belgrade calendar date and earliest day. Future dates override an untrusted urgency flag; today is checked again at persistence, with the existing 17:00 cutoff and surcharge. No availability or Order creation is implied.
- Additive migration: nullable Lead.name, nullable preferredDate (SQL DATE), preferredTime, preferredChannel and soilLevel. Existing Lead-name consumers have display fallbacks; no placeholder is persisted. Preferences appear in the current Lead card and manager notifications. Production schema is untouched. On the isolated test and Preview branches, the schema engine could not connect, so the exact reviewed migration SQL was applied transactionally through the existing pg driver with its checksum recorded in Prisma's journal. Protected data hashes matched before/after, including original Lead fields.
- 908 regression checks PASS, 26 environment-dependent checks skipped. Six live database/HTTP checks PASS, including concurrent duplicate submission, optional name, date persistence, notifications, cutoff, no-date submission, heavy soiling and upholstery enquiry. Another 66 actual AI pricing/CRM catalogue checks PASS. No Orders created; historical Order/OrderExtra fingerprints matched. The append-only audit trail is preserved; owned synthetic Leads were removed.
- TypeScript/ESLint/build pass (two existing image lint warnings). RU/SR/EN server HTML checks pass for one form, optional name, required phone, date field and compatible anchors. These are not browser hydration or visual tests.

| Acceptance | Evidence | Browser status |
| --- | --- | --- |
| Regular 55 m² / deep / two standard windows | Shared function: 6,000 / 11,400 / 12,800 RSD; live server catalogue agreement | Pending |
| Extras close/reopen; return to earlier controls | State stays mounted in the single form | Pending |
| Upholstery requested | Live database: manual Lead, null upholstery total, no Order | Pending |
| Tomorrow ↔ today; no date | Server temporal tests, actual persistence and HTTP | Pending |
| Phone without name; retry | Concurrent service + HTTP tests: one reference, null name | Pending |
| Manager receives preferred date | Persisted typed fields and notification text verified; card compiled | Visual check pending |
| RU/SR/EN | SSR + localized content and validation | Hydration/keyboard/touch pending |
| 1440/1280/1024/430/390/360, overflow, animation, CWV | No browser access | INCONCLUSIVE |

Before release: visual approval, finish browser acceptance/screenshots, merge the window-pricing dependency into main, then rebase/retarget this PR; apply the additive production migration and refresh the existing source-bound Preview booking proof through the normal release process. No channel modes, model/provider, AI persona, scheduler or historical Orders were changed.
