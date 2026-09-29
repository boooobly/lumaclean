# LumaClean — SEO checkpoint, 29 September 2026

Current checkpoint. The September 24 report remains a historical snapshot. Scope: useful SEO improvements without new work photographs or customer reviews; no paid advertising, invented proof, new service promises or false office address.

## Fresh search evidence (Chrome)

### Google Search Console

- Correct domain property: `sc-domain:lumacleanrs.com`.
- Performance report, 15 July–26 September: **25 clicks / 394 impressions / 6.3% CTR / 22.4 average position**. September 24 snapshot ended September 21: 19 / 348 / 5.5% / 23.5. These are growing cumulative periods, not a controlled before/after comparison.
- Serbian apartment service: 1 click / 95 impressions / 1.1% CTR / position 52.3. Office: 0 / 13 / 0% / 39.9. Sample is too small for a new title experiment or ranking claims.
- Indexing aggregate remains **29 indexed / 12 excluded**, but the report is still dated **September 21**. Seven historical invalid/mixed-locale 404s and five redirects; do not turn these into doorway pages.
- Sitemap: successfully processed September 24, **63 discovered URLs**. No redundant resubmission.
- Serbian office URL: indexed, smartphone crawl still **16 July**; declared and selected canonicals match. September 24 indexing request has not yet produced a new visible crawl date; no repeated request today.
- Core Web Vitals updated September 27: **insufficient field data for both mobile and desktop**. This is not a failed CWV assessment and not a pass.

### Yandex Webmaster

- Sitemap reprocessing requested September 24 succeeded: loaded **September 24, 17:08**, status OK, **63 URLs**, previously 18.
- Search list inspected across both pages: **36 listed URLs**, including all 15 service URLs and the legacy root. Some page counts differ from the September 24 snapshot; record the actual listing rather than subtracting from sitemap totals.
- Eight Russian URLs were removed as low-value/low-demand: the journal hub and guides on choosing a cleaner, frequency, arrival preparation, pricing, kitchen cleaning, bathroom deposits, and returning a rental. No HTTP-blocking diagnosis; exclusion is not proof of a specific technical defect.
- Serbian home mobile diagnostic: HTTP 200, title/description readable without JavaScript. The search-base tab dated September 24 still calls `/sr` unknown. Dashboard separately shows successful September 24 crawls for Serbian article URLs and hub; crawling is not inclusion in search.
- Site diagnostics: no errors, one recommendation to add Yandex Business. No fake walk-in office or unrelated business profile edits.
- Existing reindex history: Russian price guide's September 15 request has an error; service requests are processed. Use a small new batch only after changed pages pass production checks.

### GA4

- Property `554368271`, LumaClean — lumacleanrs.com.
- September 1–28 event report: 49 page views, 33 session starts, 11 `form_start`, 1 `generate_lead`, 1 `lead_error` (9 total users). Counts are not unique enquiries or a reliable conversion rate; earlier owner visits/tests may be present.
- Lead-acquisition report: 1 new lead, Direct; 0 qualified/converted leads recorded. Direct does not prove the true marketing source; completed work must be reconciled by the manager, not inferred from GA4.
- Added event-scoped custom dimension **Тип ошибки заявки → `error_type`**, alongside the five existing definitions. Only `validation`, `server`, `network` are permitted by site code. No names, phones or free-text errors. This does not backfill historical reports.

## Completed improvements

1. Filled all five existing Google Business Profile service descriptions in Serbian: regular, deep, moving, small offices and Airbnb turnover. Kept variable prices unspecified; added no new service category or guaranteed availability. Saved descriptions are checked by reopening their editors. Public display remains subject to Google's processing.
2. Added a base-price comparison to the existing pricing guide in RU/SR/EN, generated from the shared live price matrix and area labels. Explains fixed totals below 100 m² versus per-m² rates, extras, fractional thresholds and rounding. Publication date unchanged; substantive update September 29.
3. Added four task-oriented reading paths to the existing journal hubs, covering all 14 published guides. No new keyword-only URLs; draft same-day guide remains hidden in production.
4. Added truthful `CollectionPage` / `ItemList` markup for the visible journal catalog, plus missing Open Graph image/locale and Twitter card on all three hubs.
5. Added accurate September 29 journal/price-guide sitemap modification dates; homepage/service price dates remain September 28.
6. Upgraded the old 18-page HTTP audit to check all 63 published pages: metadata, self-canonicals, reciprocal language links, schema, navigation reachability, links/anchors, verification files, robots, redirects and 404 behavior. The pre-change audit found nine missing journal social metadata fields, now fixed locally.

## Verification before production

- ESLint, TypeScript, production build: pass (69 routes).
- Article regression: draft isolation, 45 translations including draft checks, price-table cells/rates, curated reading paths, metadata and sitemap fixtures: pass.
- Published HTTP checks: all 63 pages, 19 auxiliary checks, no issues; article suite checks 246 internal links/anchors; all 18 original price pages and 800 price/service combinations pass.
- Six changed pages × 320/390/1440 px: no horizontal overflow, blank page or framework error overlay. Browser error log empty. Screenshots inspected for Serbian accents and mobile table wrapping.
- Lead delivery tests use mocked external calls: no real test enquiries sent.
- Connected Vercel runtime-error scan before deployment: no clusters in the preceding seven days. This does not prove there were no validation errors or unsuccessful customer actions.

Production rollout and targeted reindex confirmation will be recorded after verification.

## Remaining work, without photos/reviews

- Recheck the updated RU journal/pricing guide and the newly crawled SR catalog after search-base updates; do not repeatedly submit unchanged queued pages.
- For the other excluded guides, inspect actual demand and content utility before rewriting or merging; do not blindly unpublish seven useful articles from one low-demand classification.
- Validate real bookings against the manager's `LC-...` reference; the agent has no confirmed booking/completion ledger.
- Human Serbian editorial review remains useful; automated checks are not a native-speaker approval.
- Legitimate citations can use only confirmed public business facts. New directory accounts, legal terms, registration details or paid placement require owner participation; no mass submissions or link purchases.
- Same-day draft still requires owner approval of operational availability before publication.

Real work photos and legitimate reviews remain a separate trust-building step, not a prerequisite for today's technical/content changes. Search-engine crawl and inclusion timings are external and cannot be forced.
