# SEO status — 21 September 2026

## Completed in this stage

- Reconciled the saved roadmap with the code and later reports. The mobile accessibility work, reduced-motion behavior, responsive templates and iPhone journey handoff have already been completed; they were not repeated.
- Checked three URLs from the 20 September Google priority-crawl batch. The Serbian and English article indexes and the Serbian guide to choosing a cleaning service are now indexed. No duplicate indexing or sitemap requests were sent.
- Strengthened the Serbian small-office service page around the confirmed Search Console query `čišćenje kancelarija`: the title and description now expose the starting price, the page explains one-off versus recurring work, and the FAQ contains the actual area-based price ladder and separately charged work.
- Kept the existing URL and page intent. No district pages, duplicate keyword variants or unsupported commercial-cleaning services were added.
- Updated only the Serbian office service `lastmod` to 21 September. Other language versions retain their existing modification dates.

## Evidence and limits

- Search Console data for 15 July–17 September showed 7 impressions for `čišćenje kancelarija` and no clicks. This is a real relevance signal, not enough data to claim ranking growth or a CTR problem.
- The aggregate indexing report is dated 18 September and is stale relative to URL Inspection. Confirmed URL-level results are recorded in `SEO_INDEX_STATUS_2026-09-19.md`.
- Google Keyword Planner frequency remains unavailable. No advertising account or campaign was created.
- No new claim is made about Yandex reassessment, rankings, traffic, leads or completed bookings.

## Verification before deployment

- `npx eslint src`, `npx tsc --noEmit`, `git diff --check` and the article status/metadata fixture passed.
- The production build generated all 69 routes.
- The local production page at 390 × 844 rendered one H1, the expected title, description and canonical, five FAQ entities, no `noindex`, no horizontal overflow, no framework overlay and no browser warnings or errors.
- The estimate anchor settled below the fixed header and kept the office service selected in the calculator.
- The local sitemap still contains 63 URLs and gives only `/sr/services/ciscenje-kancelarija` the new `2026-09-21` service modification date.

## Next checkpoints

1. Recheck the remaining URLs from the 20 September priority batch after Google has had time to process them; do not resubmit unchanged URLs.
2. Compare new Serbian query-to-page data for apartment and office cleaning after a larger observation window.
3. Check Yandex crawl dates for the five Russian service pages before considering another recrawl request.
4. Obtain native Serbian editorial review and real work photos/reviews when the owner can provide them.

## Production

- Code commit: `06130de`.
- Deployment: `dpl_HXCsxCXouNRGkotJWxNxLRpM8fZW`, READY, aliased to `https://lumacleanrs.com`.
- The production office page returned HTTP 200 with the expected title and canonical, five FAQ entities and no `noindex`.
- The production sitemap returned 63 URLs and the Serbian office page has `lastmod` `2026-09-21T00:00:00.000Z`.
- Mobile production browser verification at 390 × 844 found no horizontal overflow, framework overlay, console warning or error.
- Vercel runtime error scan after deployment returned no errors.

## Lead measurement follow-up

- Added a privacy-safe reference in the form `LC-YYYYMMDD-XXXXXXXX` to each validated delivery attempt. The reference is included in the Telegram message so the manager can reconcile an enquiry with an agreed booking and completed job without copying personal details into analytics.
- Added structured server logs for validation, delivery start, confirmed delivery and delivery failure. Logs contain only the reference, locale, whitelisted source/landing data, request ID, technical result and duration; they exclude names, phone numbers, comments and estimates.
- Added a 30/60/90-day measurement plan that keeps search visibility, enquiries, agreed bookings and completed jobs as separate stages.
- The automated test uses a mocked Telegram request and explicitly checks that server logs contain no test name or phone. No real enquiry was generated during verification.
- Local checks passed: SEO event test, article fixture, ESLint, TypeScript, `git diff --check` and the 69-route production build.
- Production at 390 × 844 returned one H1, one form, no `noindex`, no horizontal overflow and no framework overlay. Empty submission marked all three required fields and made zero `/api/lead` requests.
- A deliberate empty API payload returned HTTP 400 and produced only the expected privacy-safe `lead_validation_failed` warning. It did not contact Telegram. No production runtime errors were present after deployment.
- Code commit: `15cb8ae`.
- Deployment: `dpl_BFebQYRFsAS5zXuJ5HeVdNdS92Wc`, READY, aliased to `https://lumacleanrs.com`.
