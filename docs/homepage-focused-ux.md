# LumaClean: focused homepage UX — review report

PR: https://github.com/boooobly/lumaclean/pull/23
Preview: https://lumaclean-8itggfkkk-vladislavs-projects-0eae0ea3.vercel.app/ru
Reviewed application commit: ab6fabc871ac7985a7ddceb9f5f0ae5a50dc7de8.
Production/main baseline: 93e8e3d34ff51eaffa42cb98950756c97623cee8.

## Scope and structure

| Check | Result |
| --- | --- |
| Seven numbered sections in approved order | PASS |
| Old process section 04 removed | YES |
| Single main calculator moved to 04 | YES |
| Independent phone + consent form in 07 | YES |
| ApartmentExperience, video, assets, scroll scrubbing and JourneyHandoff preserved | YES; unchanged source diff |
| Sections 01, 03, 05, 06 preserve production layout | YES; only the separately approved window prices change in 03 |
| #estimate, #rates and old #method links | PASS; #estimate belongs to the form, #method remains a compatible anchor in terms |

## Pricing and forms

| Check | Result |
| --- | --- |
| Sliding row highlight / 300 ms easing | DONE |
| Selected column and intersection | DONE |
| Presentation-only 400 ms number animation | DONE |
| Fast changes cancel and redirect the counter | PASS |
| 100+ m² correctly labelled as a rate | PASS; changing between total and per-m² remounts the number immediately, never tweening incompatible units |
| Reduced motion | PASS in Chrome emulation; new motion disabled, final values correct |
| Calculator simplified with primary services and disclosures | YES; every previous service and extra retained |
| Extras retained after closing and upholstery round trip | PASS |
| Optional Lead name | PASS; genuine null, safe Admin fallbacks and editable blank client name |
| Mini-form Lead without service, area or price | PASS; CONTACT_REQUEST in existing Lead lifecycle |
| Concurrent idempotency / retry after a lost response | PASS; one Lead, one creation audit, no Order |
| Consent / attribution | PASS validation and existing consent-gated attribution; no PII in analytics events |
| Durable notification creation and injected delivery | PASS |
| Actual manager notification delivery on Preview | FAIL — INTERNAL_TELEGRAM_UNCONFIGURED; missing internal Telegram configuration in Preview. Both real test jobs correctly record FAILED rather than claiming delivery |

No new pricing engine or animation dependency. The shared pricing source remains authoritative. Standard/large windows are 700/1,000 RSD, transferred exclusively from pricing PR #21. The factual knowledge snapshot changes only those approved price values. Provider/model, prompts, channel modes, scheduling and booking implementation are unchanged.

Two compatible migrations: nullable Lead.name; expand the existing request-kind allowlist and add a CONTACT_REQUEST invariant constraint. Existing rows are preserved. Applied only on the dedicated Neon test branch and existing isolated Preview branch; historical data fingerprints matched before/after. No production migration.

## Evidence

- TypeScript PASS; npm build PASS locally and Vercel deployment READY.
- ESLint: 0 errors, 2 existing website-chat image warnings.
- 916 agent/admin/CRM/finance/scheduling checks PASS; 26 environment-dependent checks skipped.
- 70 routing checks PASS with the fixed October 2 fixture clock; 2 integrations skipped. At the real current date two unchanged Google routing tests fail because their October 2 request is outside the provider's seven-day history window; no routing code or tests were changed to conceal this.
- 7 real database checks PASS: RU/SR/EN contact requests, parallel submissions, audit, injected notification delivery, optional names, all cleaning types, windows, upholstery, invalid data and unchanged historical fingerprints.
- 66 real AI server-tool / public / active CRM catalogue pricing checks PASS on the dedicated test branch. No Orders created.
- Total: 1,059 passing checks, 28 environment-dependent skips; the wall-clock routing caveat above is explicit.
- Browser: RU/SR/EN × 1920×1080, 1440×900, 1280×800, 1024×768, 430×932, 390×844, 360×800. No horizontal page overflow, seven numbers, one calculator plus one mini-form, all fragment targets exist. Desktop Chrome retains its native 15 px scrollbar within the requested viewport. Stabilized form top is approximately 100 px; sticky header is 82/62 px.
- Actual Chrome price changes: regular/deep, all area bands including 100+, rapid switches; mobile table horizontal scroll verified. Main form: two standard windows → 7,400 RSD; disclosure closing and upholstery-only round trip retain values.
- Actual Preview main submission: LC-20261018-03A818F7, null name, CLEANING_UPHOLSTERY, 55 m², 7,400 RSD excluding manually assessed upholstery, humanReviewRequired=true, consent, WEBSITE/ru, zero Orders.
- Actual Preview contact submission: LC-20261018-957092AD, CONTACT_REQUEST, null name/service/area/price, consent, WEBSITE/ru, zero Orders. Synthetic review fixtures are marked in internal notes; no real customer message is sent.
- Browser error testing on a local proxy over the dedicated test branch: 503 shows error, a dropped connection is retried with the same submissionId, successful retry creates one Lead. Paused response after server persistence → client timeout/error → successful same-key retry also leaves one Lead and no Order.
- Authenticated isolated Admin browser check: both request types render; missing name and service have explicit fallbacks, no false upholstery warning on contact requests.
- Accessibility: native labels and disclosures, keyboard operability/focus styles, required consent/phone, optional name, pressed row state, polite final-price announcement. New main text contrast against paper is 15.21:1 (ink), 6.19:1 (secondary), 5.19:1 (teal). This is a targeted manual/DOM check, not a full external accessibility certification.

Screenshots and the 21-case JSON matrix are stored locally in output/playwright/. Representative final files: desktop-form-1440-final.jpg, desktop-rates-1440.jpg, desktop-contact-1440-final.jpg, ru-form-390.jpg, mobile-rates-390.jpg, mobile-contact-390-final.jpg. Screenshots were actually captured and inspected; owner visual approval is still required.

## Rejected redesign and release gates

Rejected PR #22 is CLOSED. Its branch codex/conversion-ux remains saved at 70b5d341c7177f7950f57f1200127e42d1332b4f; no merge or cherry-pick from it. Its unique redesign/preferences work is preserved on that branch. Only the independent approved window patch is included here.

Old unwanted Preview: dpl_GfQccoojYBw2jFm7CVrPcvXQuzjy / https://lumaclean-fwf0iyetn-vladislavs-projects-0eae0ea3.vercel.app . It has no production/custom-domain aliases and target=null; production is dpl_6iY3Kzu6FnKZQM1RTot5ysA83TzP. The old READY Preview was NOT deleted: connected Vercel tools expose cancellation of in-progress builds but no delete/deactivate operation, and the local CLI lacks credentials. Manual action: open https://vercel.com/vladislavs-projects-0eae0ea3/lumaclean/GfQccoojYBw2jFm7CVrPcvXQuzjy and delete ONLY this deployment from its menu. Do not delete the project, environment variables, domains, database, branch or other Previews.

Before production: owner visual approval, Preview Telegram test configuration/delivery confirmation, normal production migrations and the two-row prospective catalogue update, refreshed source-bound native booking proof. The source inventory/testing evidence is refreshed; it does not pretend that live booking proof has been repeated. No production merge/deploy is authorized or performed. Field/lab LCP, CLS and INP and physical-device touch performance have not been measured; no performance uplift is claimed.

## Exact changed files

- `prisma/migrations/20261018190000_optional_website_lead_name/migration.sql`
- `prisma/migrations/20261018190100_contact_request_kind/migration.sql`
- `prisma/schema.prisma`
- `release/ai-go-live.json`
- `scripts/admin/update-window-pricing.ts`
- `src/app/[locale]/page.tsx`
- `src/app/[locale]/site.css`
- `src/app/admin/(workspace)/clients/new/page.tsx`
- `src/app/admin/(workspace)/leads/[id]/page.tsx`
- `src/app/admin/(workspace)/leads/page.tsx`
- `src/app/admin/(workspace)/orders/new/page.tsx`
- `src/app/admin/(workspace)/orders/upholstery/page.tsx`
- `src/app/admin/(workspace)/page.tsx`
- `src/app/api/lead/route.ts`
- `src/app/styles/homepage-focused.css`
- `src/components/site/animated-price.tsx`
- `src/components/site/contact-request.tsx`
- `src/components/site/estimate.tsx`
- `src/components/site/rates.tsx`
- `src/lib/agent/knowledge/snapshot.json`
- `src/lib/content.ts`
- `src/lib/homepage-ux-content.ts`
- `src/lib/lead-intent.ts`
- `src/lib/pricing.ts`
- `src/lib/seo-services.ts`
- `src/lib/services/lead-notifications.ts`
- `src/lib/services/website-leads.ts`
- `src/lib/site-content.tsx`
- `src/lib/validation/crm.ts`
- `src/lib/website-phone.ts`
- `tests/agent/approved-pricing-integration.test.ts`
- `tests/agent/conversion-hardening.test.ts`
- `tests/agent/conversion-integration.test.ts`
- `tests/agent/window-pricing.test.ts`
- `tests/crm/approved-pricing.test.ts`
- `tests/crm/contact-request-integration.test.ts`
- `tests/crm/contact-request.test.ts`
- `docs/homepage-focused-ux.md`

