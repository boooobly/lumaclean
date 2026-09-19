# Index status by sitemap URL — 2026-09-19

Checked against the live 63-URL sitemap, Google Search Console URL Inspection and Yandex Webmaster on 19 September 2026.

## Summary

| Source | Confirmed current result |
| --- | --- |
| Google URL Inspection | 21 indexed; 42 unknown to Google |
| Google Page indexing aggregate | 18 indexed / 12 not indexed, but last updated 14 September and therefore stale |
| Google sitemap report | Successful, but last processed 13 September and still reports only 18 discovered URLs |
| Yandex pages in search | 21 sitemap URLs confirmed; 14 RU articles were added on 15 September |
| Yandex excluded | 5 RU service pages remain “low-value or low-demand”; their last visits are 21 July–8 September |
| Yandex not listed in either current table | 37 sitemap URLs: RU article index, all 21 SR URLs, EN article index and 14 EN articles |

The Yandex searchable table also contains the non-sitemap root redirect `/`; it is excluded from sitemap counts below.

## Technical validation

A server-side batch check of every sitemap URL found:

- 63/63 returned HTTP 200;
- 63/63 had a self-referencing canonical;
- 63/63 exposed at least three language alternates;
- 0/63 had a meta or HTTP `noindex`;
- 42/42 article pages were linked from their locale article index.

No shared technical indexing defect was found. Google’s 42 unknown statuses are discovery/crawl states, not evidence of a robots, canonical or availability error.

## URL table

Abbreviations: `Indexed` = Google URL Inspection says the URL is in Google; `Unknown` = “URL unknown to Google”; `Search` = present in Yandex search; `Low value` = excluded by Yandex as low-value/low-demand; `Not listed` = absent from both current Yandex search and excluded tables. Dates are the last crawl/visit shown by the platform.

| URL | Google | Google crawl | Yandex | Yandex visit | Next action |
| --- | --- | --- | --- | --- | --- |
| `/ru` | Indexed | 18 Sep 09:49 | Search | 5 Sep | Observe |
| `/ru/services/uborka-kvartir` | Indexed | 4 Sep | Low value | 4 Sep | Google recrawl candidate; wait for Yandex reassessment |
| `/ru/services/generalnaya-uborka` | Indexed | 25 Aug | Low value | 6 Sep | Google recrawl candidate; wait for Yandex reassessment |
| `/ru/services/uborka-pri-pereezde` | Indexed | 24 Aug | Low value | 3 Sep | Google recrawl candidate; wait for Yandex reassessment |
| `/ru/services/uborka-airbnb` | Indexed | 26 Aug | Low value | 8 Sep | Google recrawl candidate; wait for Yandex reassessment |
| `/ru/services/uborka-ofisov` | Indexed | 25 Aug | Low value | 21 Jul | Google recrawl candidate; wait for Yandex reassessment |
| `/ru/articles` | Indexed | 16 Sep 07:47 | Not listed | — | Observe Google; Yandex discovery candidate |
| `/ru/articles/kak-vybrat-klining-v-belgrade` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/uborka-pered-sdachey-kvartiry` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/mytyo-okon-chto-vhodit` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/uborka-airbnb-mezhdu-gostyami` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/kak-chasto-zakazyvat-uborku` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/uborka-kuhni-chto-vhodit` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/spisok-rabot-dlya-uborki-ofisa` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/skolko-vremeni-zanimaet-uborka` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/uborka-kvartiry-ot-shersti` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/nalyot-v-vannoy-chto-mozhno-otmyt` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/podderzhivayushchaya-ili-generalnaya-uborka` | Indexed | 18 Sep 09:51 | Search | 15 Sep | Observe |
| `/ru/articles/podgotovit-kvartiru-k-uborke-pered-vezdom` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/ru/articles/stoimost-uborki-kvartiry-v-belgrade` | Indexed | 16 Sep 07:50 | Search | 15 Sep | Observe |
| `/ru/articles/kak-podgotovitsya-k-priezdu-klinerov` | Unknown | — | Search | 15 Sep | Google indexing candidate |
| `/sr` | Indexed | 4 Sep | Not listed | — | Google recrawl candidate; Yandex discovery candidate |
| `/sr/services/ciscenje-stanova` | Indexed | 16 Jul 06:18 | Not listed | — | Google recrawl candidate; Yandex discovery candidate |
| `/sr/services/generalno-ciscenje` | Indexed | 16 Jul 06:42 | Not listed | — | Google recrawl candidate; Yandex discovery candidate |
| `/sr/services/ciscenje-pri-selidbi` | Indexed | 16 Jul 06:44 | Not listed | — | Google recrawl candidate; Yandex discovery candidate |
| `/sr/services/ciscenje-airbnb-apartmana` | Indexed | 16 Jul 07:55 | Not listed | — | Google recrawl candidate; Yandex discovery candidate |
| `/sr/services/ciscenje-kancelarija` | Indexed | 16 Jul 06:52 | Not listed | — | Google recrawl candidate; Yandex discovery candidate |
| `/sr/articles` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/kako-izabrati-agenciju-za-ciscenje` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/ciscenje-pre-predaje-stana` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/sta-ukljucuje-pranje-prozora` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/ciscenje-apartmana-izmedju-gostiju` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/koliko-cesto-zakazivati-ciscenje` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/sta-ukljucuje-ciscenje-kuhinje` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/plan-ciscenja-male-kancelarije` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/koliko-traje-ciscenje-stana` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/dlake-kucnih-ljubimaca-u-stanu` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/naslage-u-kupatilu-sta-moze-da-se-ocisti` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/redovno-ili-generalno-ciscenje` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/priprema-stana-za-ciscenje-pre-useljenja` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/od-cega-zavisi-cena-ciscenja-stana-beograd` | Unknown | — | Not listed | — | Indexing candidate |
| `/sr/articles/kako-se-pripremiti-za-dolazak-tima` | Unknown | — | Not listed | — | Indexing candidate |
| `/en` | Indexed | 28 Aug | Search | 2 Sep | Google recrawl candidate |
| `/en/services/apartment-cleaning` | Indexed | 16 Jul 06:19 | Search | 6 Sep | Google recrawl candidate |
| `/en/services/deep-cleaning` | Indexed | 20 Aug 07:48 | Search | 3 Sep | Google recrawl candidate |
| `/en/services/move-in-move-out-cleaning` | Indexed | 16 Jul 06:24 | Search | 3 Sep | Google recrawl candidate |
| `/en/services/airbnb-cleaning` | Indexed | 16 Jul 07:21 | Search | 4 Sep | Google recrawl candidate |
| `/en/services/office-cleaning` | Indexed | 16 Jul 06:22 | Search | 21 Jul | Google recrawl candidate |
| `/en/articles` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/choose-cleaning-service-belgrade` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/move-out-cleaning-checklist` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/what-window-cleaning-includes` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/airbnb-turnover-cleaning-checklist` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/how-often-to-book-cleaning` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/kitchen-cleaning-checklist` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/small-office-cleaning-checklist` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/how-long-apartment-cleaning-takes` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/pet-hair-apartment-cleaning` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/bathroom-deposits-and-surface-damage` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/regular-or-deep-cleaning` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/prepare-apartment-for-move-in-cleaning` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/apartment-cleaning-cost-belgrade` | Unknown | — | Not listed | — | Indexing candidate |
| `/en/articles/prepare-for-cleaners-arrival` | Unknown | — | Not listed | — | Indexing candidate |

## Recommended request batch

Do not submit all 42 unknown Google URLs at once. The first balanced batch should use eight discovery requests and two recrawl requests:

1. `/sr/articles`
2. `/en/articles`
3. RU/SR/EN versions of the “choose a cleaning service” article
4. RU/SR/EN versions of the move-out/hand-over article
5. `/ru/services/uborka-kvartir`
6. `/ru/services/generalnaya-uborka`

The two RU services were substantially rewritten on 16 September and have not been crawled since. The article index and article requests can expose their language clusters through internal links and hreflang. Record accepted requests as requests only; verify index status again later.

Yandex already processed the 15 service recrawl requests made on 16 September. The five RU service entries still show pre-update visit dates, so do not repeat the same request yet. Recheck for a new visit or status change before another submission.

