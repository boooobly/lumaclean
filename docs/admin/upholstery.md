# Upholstery: operations and release evidence

The configurable `UpholsterySettings` catalogue is the shared source for server quotes, public pages/article examples, CRM and AI tools. Existing area-service matrices and historical snapshots are retained. `Order.pricingBasis=ITEMS` allows area zero only for a furniture-based order. Existing orders remain AREA. `OrderUpholstery` holds input, item breakdown, agreed total and independent review/resource details.

Standalone minimum is a top-up to the item subtotal, not a second visit charge. ADDON has no standalone floor. Furniture and local treatment on the same identified item cannot be charged twice. The current server date policy and shared +20% rounding apply; clients and LLMs cannot choose a cheaper urgency interpretation. Combined enquiries preserve the home-cleaning component and use a single computed total. Adding treatment to an existing order preserves its agreed home-cleaning price.

## Administration

Orders → «Создать химчистку мебели»; an open regular order → «Добавить химчистку мебели». Review the material, photos for heavy soiling, final price, preparation/work/cleanup/transport minutes, numbered extractor, custodian in the assigned team and delivery/return plan. Minutes are empty until explicitly assessed; no calibrated norm is invented. Price changes need a reason. Saving affects only that DRAFT, with no client booking notification. Status confirmation is a separate guarded action. Before treatment, explicitly record the on-site colourfastness/material test.

Settings → «Химчистка мебели · прайс и оборудование». Initially one extractor; quantity can be corrected. Reducing capacity below units assigned to open jobs is blocked. Equipment checks use a transaction-wide resource lock across all teams and include the whole order, cleaning reserve and transport buffer. Unknown intervals and unresolved review block scheduling. Scheduling overrides cannot waive equipment/material errors. Rescheduling and status transitions recheck constraints.

Calendar copies retain financial/planning input, but reset upholstery review, on-site test, photos and approval. They need a fresh assessment for the new visit. Earlier order finance, expenses, payments, payouts, AI confirmation and logistics history are not inherited.

Website enquiries create a consented, idempotent Lead, not a booking. Link the lead to a client/address in CRM, then create the upholstery DRAFT. Combined enquiries can create the regular cleaning with furniture as an extra. Existing orders use their dedicated editor.

## AI scope

RU/SR/EN detection activates a persistent furniture-review boundary. `calculateUpholstery` computes every amount. Price output must match tool facts; unsupported duration and booking claims are blocked. The AI can consult, request photographs and quote, but cannot estimate an uncalibrated duration, offer slots, book or reschedule upholstery. The existing area-service AUTO scope and channel modes are unchanged. Upholstery AUTO is **BLOCKED** until a separate full Preview booking proof covers confirmed norms, equipment, transport, price and explicit recap confirmation.

## Public URLs

- `/sr/dubinsko-pranje-namestaja`
- `/ru/himchistka-mebeli`
- `/en/upholstery-cleaning`
- `/sr/articles/dubinsko-pranje-namestaja-beograd-cene-karcher`
- `/ru/articles/himchistka-mebeli-belgrad-ceny-karcher`
- `/en/articles/upholstery-cleaning-belgrade-prices-karcher`

Commercial pages and informational articles have different content and intent, reciprocal links, canonical and hreflang. All published URLs enter the sitemap. Preview articles retain the existing noindex policy. No claim is made that Google has indexed them. Search Console access must be established separately if unavailable.

## Verification

`tests/finance/upholstery.test.ts` covers owner examples, minimum, add-on, quantities, soil/material review, configurable catalogue, shared urgency, equipment intervals, multilingual detection and AI output safety. `scripts/admin/upholstery-proof.ts` is hard-restricted to the isolated Neon Preview endpoint and verifies real transactions, rollback-only preview, idempotency, one-extractor conflicts across teams, pending/unsafe material blocks, agreed cleaning price, calendar reset and AI tool boundaries. It preserves channel modes. Its cleanup deletes only owned fixtures; an inactive actor remains for the append-only audit trail.

Release still requires affected lint/typecheck/build, desktop and 390/430 browser QA, deployed Preview proof for existing regular AI booking, production history preservation and read-only production smoke. Production test Orders are prohibited. Evidence is recorded only after each check actually runs.
