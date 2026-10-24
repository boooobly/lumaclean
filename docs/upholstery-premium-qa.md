# Upholstery page verification — 2026-10-23

Base: `origin/main` at `e9e7ba1`; branch: `codex/upholstery-premium-page`.
Local production build: `http://localhost:3101`. No environment files or live database credentials were copied.
Pricing: `docs/pricing-update-20261017.md`, current `src/lib/upholstery.ts`, `getUpholsteryCatalog`, and shared `src/lib/pricing.ts`. No pricing/backend/schema/agent/homepage changes.

| Locale | 1440 | 1024 | 768 | 390 | 375 | 320 |
|---|---|---|---|---|---|---|
| RU | PASS | PASS | PASS | PASS | PASS | PASS |
| SR (Latin) | PASS | PASS | PASS | PASS | PASS | PASS |
| EN | PASS | PASS | PASS | PASS | PASS | PASS |

Chrome, viewport height 1000. All images loaded; no horizontal overflow. Desktop and mobile full-page screenshots inspected against the existing homepage. Expanded FAQ and material fields checked at 320 px. All six language-switch directions work; switching languages resets the form.

- `npm run typecheck`: PASS.
- `npm run lint`: PASS, two existing `no-img-element` warnings in `website-chat.tsx`.
- `npm run build`: PASS.
- `node --conditions=react-server --import tsx --test tests/finance/upholstery.test.ts tests/finance/upholstery-lead-mocked.test.ts tests/crm/approved-pricing.test.ts`: **87 PASS**, no skips.
- Browser script: **18 layout checks PASS**, plus calculator/lead scenarios below. No page errors or unexpected console errors. Five expected resource errors come from intentionally failed API mocks.

Browser coverage: minimum visit, quantities, corner seating, combined cleaning, heavy/unknown/unsafe fabrics, mixed stain/item validation, add/remove, gallery-to-calculator selection, consent/contact validation, 400/429/503, offline/timeout mocks, loading, duplicate submit, retry idempotency and a new key after edits. The photo action opens the existing chat and its attachment input; no messages or photos were sent. Reduced motion was enabled throughout.

The unchanged server intake was executed with a mock database: it recomputes the quote, saves a human-review Lead, records consent, queues a pending Telegram notification, deduplicates the same submission, rejects conflicting reuse and unsafe fabric, and never creates an Order. HTTP rate limiting remains in the unchanged API route.

**Limits:** browser submissions and chat are mocked; server persistence/outbox are mocked. Real PostgreSQL persistence, external notification delivery and live photo processing were not exercised. No live enquiries, migrations, seed, production deployment or production mutations.

Rerun the browser script using an available `playwright-core` package (for example the official `@playwright/cli@0.1.22` runtime), setting `PLAYWRIGHT_CORE_PATH` to its `index.mjs`, and `BASE_URL` to the test server. Run `node tests/browser/upholstery-premium.mjs`. Screenshots and machine-readable results go to ignored `artifacts/upholstery-premium/`.

Image provenance and full generation prompts: `docs/upholstery-premium-media.json`. Four new illustrative WebP images, 739 KB total; existing textile image reused. Gallery disclosure is translated into all three languages.

## Final UI and motion polish — 2026-10-24

Approved page composition retained. Native select wrappers now have one decorative 14×8 chevron, 18 px from the right edge, vertically centred, with 48 px of text padding. Furniture uses stable UI keys, grouped paper cards and short add/remove transitions; UI keys never enter the API payload. Status messages and button labels reserve their space.

`tests/browser/upholstery-polish.mjs`: **30 PASS** (Chrome and WebKit 26.6 × RU/SR/EN × 1440/1024/768/390/320). Expanded parameters, two items, corner seats, all fabric states, combined cleaning, native chevron geometry, validation/400/429/503/offline/timeout, loading/success, retry idempotency and stable removal checked with mocked APIs. No status-card height change. Normal/reduced motion, disabled JavaScript and a failing enhancement observer checked; scroll CLS below .01. No unexpected console/page errors.

Typecheck/build/lint PASS (the same two existing chat image warnings). Seventeen focused upholstery pricing/intake tests PASS. No dependencies, media assets, backend, prices, CRM, AI, schema or migration changes in this polish. Browser output, before/after screenshots and recordings remain in ignored `artifacts/upholstery-polish/`.
