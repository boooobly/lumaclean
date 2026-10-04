# SEO checkpoint — 24 September 2026

This supersedes the *current-status* numbers in `SEO_INDEX_STATUS_2026-09-19.md`; its historical URL table remains a record of the 19 September inspection. Search-console totals are not the same as a 63-URL sitemap audit.

## Search visibility

| Source | Observed state | Interpretation / action |
| --- | --- | --- |
| Production sitemap | HTTP 200, 63 canonical URLs | No site or deployment change required. |
| Google sitemap report | Successful; processed 24 Sep; 63 discovered URLs | Current sitemap is accepted. Do not resubmit it. |
| Google page indexing aggregate | 29 indexed, 12 not indexed; report dated 21 Sep | Up from 22 indexed in the earlier aggregate, but not proof that every sitemap URL has been processed. |
| Google non-indexed reasons | 7 404s and 5 redirects | The 404s are mixed-locale/incorrect service slugs absent from site source and sitemap. The five redirects include canonical host/protocol/root redirects and a legacy service URL. No evidence of a broken canonical sitemap URL. |
| Google performance | 19 clicks, 348 impressions, 5.5% CTR, average position 23.5; 15 Jul–21 Sep | Still too little non-brand query data for a defensible title/CTR rewrite. Previous complete view was 18 clicks and 317 impressions through 17 Sep. |
| Yandex search pages | 48 total: 47 sitemap URLs plus the root redirect | All 15 service URLs and all 28 RU/EN article URLs are in search. This includes the five RU services previously excluded as low-value; the current low-value count is zero. |
| Yandex excluded | 3 old service redirects, 0 HTTP errors, 0 low-value pages | No remediation indicated for the redirect rows. |
| Yandex query statistics | 23 impressions, 1 click, 4.34% CTR; 19 Aug–19 Sep | Insufficient demand signal for content changes. |

The 16 sitemap URLs not yet listed in Yandex search are `/sr`, `/sr/articles`, and the 14 Serbian articles. The Yandex sitemap report still showed the 9 September copy with only 18 links, despite the production sitemap having 63. The existing sitemap was sent for reprocessing on 24 September at 17:07 (Webmaster confirmation; remaining manual reprocess allowance changed from 10 to 9). **This is a request, not confirmation of a new crawl or indexing.** Check when the sitemap report updates before submitting individual URLs.

## URL-level Google checks

- `/ru/articles/kak-vybrat-klining-v-belgrade` is indexed; successful Smartphone crawl on 20 Sep, self-canonical.
- `/en/articles/choose-cleaning-service-belgrade` remains unknown to Google. Its 20 Sep indexing request was accepted and the URL is in the now-processed sitemap; do not repeat an unchanged request while it is queued.
- The three move-out articles in RU/SR/EN appear in the indexed list, crawled 20 Sep.
- `/ru/services/uborka-kvartir` and `/ru/services/generalnaya-uborka` remain indexed but had no new crawl after their 20 Sep recrawl requests at inspection time.
- `/sr/services/ciscenje-kancelarija` is indexed, but its displayed last crawl was 16 Jul, before the 21 Sep page update. A fresh indexing request was accepted by Google on 24 Sep. Wait for a new crawl date; do not resubmit the same content.

## Local profile and operations

- The confirmed Google Business Profile already lists the five offered services: standard, deep, office/workplace, move-in/out and Airbnb turnover. Its Belgrade service area, Serbian number, site link with `google_business_profile` campaign tag and daily 09:00–22:00 hours match the current site. No duplicate services or unsupported claims were added.
- Google Business Profile performance for Apr–Sep showed 3 mobile Maps views and 0 interactions. This is not evidence of leads or bookings.
- Yandex Webmaster's single recommendation is to add the organisation to Yandex Business. A Maps search for `LumaClean` in Belgrade found no card, and the signed-in Business account contains only an unrelated company. The Business form offers a no-customer-visit option, but Yandex's [official guidance](https://yandex.com/support/business-priority/en/online-company) says such profiles are available only by direct link and are **not published in Maps/search results in Maps**. It also advises against using a personal Yandex login because ownership cannot be transferred. No LumaClean profile was submitted. Do not claim a walk-in office or create a false Maps pin merely to satisfy the recommendation.
- No production code was changed or deployed during this checkpoint. A production deploy would not accelerate a search engine's pending recrawl.

## Next decisions

1. After Yandex reprocesses the sitemap, confirm that it reports 63 links and check discovery/indexing of the 16 missing Serbian URLs. Escalate only if the updated sitemap is accepted yet those pages remain absent after another crawl window.
2. Recheck the few Google priority URLs by their last crawl dates, not by repeated indexing requests. Compare complete 28-day periods once non-brand impressions grow.
3. Keep the prepared same-day article unpublished until operational availability and owner approval are confirmed. Request genuine job photographs and customer reviews only when available with rights/consent.
4. Reconcile real enquiry references `LC-...` against bookings and completed jobs without copying personal details into analytics. No production test lead was sent.
