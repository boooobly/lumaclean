# Updated floor-area price bands — 28 September 2026

The owner confirmed the new bands: **up to 39 / 40–59 / 60–79 / 80–99 / 100 m² and up**. All five services retain their existing amounts and per-metre rates. Extras, the minimum order, rounding and same-day surcharge are unchanged.

## Implementation

- `basePrice` now changes bands at exactly 40, 60, 80 and 100 m².
- The three homepage price lists and all 15 service price tables share one translated label source in `pricing.ts`.
- The Serbian office FAQ and its generated FAQ structured data use the revised bands.
- Article and service calculation examples still use the shared calculation function. Their example areas (35, 55 and 70 m²) are not boundary values, so their displayed amounts are unchanged.
- Sitemap modification dates were updated only for the 18 home/service pages whose public price tables changed. The 63-URL count, URLs, article dates and language alternates remain unchanged.
- A search of site source, translations and public assets found no old range labels remaining. Historical audit records were not rewritten as if they reflected the new tariff.

## Pre-deployment verification

- `node docs/check-pricing.cjs`: 800 area/service cases, exact preservation of tariff amounts/extras, consistent RU/SR/EN labels and no old FAQ ranges.
- `node docs/articles/check-seo-events.cjs`, `node docs/articles/check-articles.cjs`, ESLint, TypeScript and `git diff --check`: passed. No real enquiry was sent.
- Production build: passed; all 69 routes generated.
- `node docs/check-pricing.cjs http://localhost:3100`: all 18 price pages HTTP 200, new bands present, old bands absent, no `noindex`, 63 sitemap URLs and 18 pricing modification dates.
- Hydrated-browser calculation: 50 cases across all five services at 39/40, 59/60, 79/80, 99/100, 101 and 180 m² passed. At 40 m² regular cleaning is 4,600 RSD, as intended.
- Mobile viewport 390 × 844: new rate selector visible, no horizontal page overflow, no framework overlay or browser errors. The Serbian office page retained office selection and its 4,700 RSD estimate at 55 m².

## Production verification

Pending deployment and post-deployment checks.
