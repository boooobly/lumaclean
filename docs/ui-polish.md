# Public UI polish — 2026-10-19

Continuation of PR #23 on `codex/homepage-focused-ux`. No production release is authorized.

## Audit and local fixes

Audit baseline: READY Preview `lumaclean-8itggfkkk-vladislavs-projects-0eae0ea3.vercel.app`, application commit `ab6fabc`.

| Priority | Observed issue | Local correction |
| --- | --- | --- |
| High | Wide closed chat covered the calculator consent/submit area on desktop/tablet. | Homepage closed launcher uses a 44 px icon in the outer gutter; accessible name and full opened chat remain. |
| High | At 1024 px the header CTA wrapped and English links crowded the locale control. | Explicit responsive columns, smaller logo/nav gaps and single-line CTA between 901–1200 px. |
| Medium | Main form scenario selector had a square border and native arrow unlike the other controls. | Matching paper surface, radius, arrow, hover/focus and 52 px target; 16 px input text. |
| Medium | Selected price reserved six characters, leaving an arbitrary gap before RSD. | Natural number width, preserved tabular numerals and stable result height. |
| Medium | Mobile terms heading stranded the Russian preposition on its own line; title and cards were too tall. | Local mobile padding/type wrapping and content-based height; smaller card heading gap. |
| Medium | Upholstery RSD heading was left aligned above right aligned prices; narrow CTA and uneven headline wrap. | Matching numeric column alignment, tabular figures, balanced heading and full-width mobile CTA using existing brand tokens. |
| Low | Public upholstery colors/background depended on order of two global selectors. | Explicit page-scoped ink and existing textured paper; shared admin/form styles unaffected. |
| Low | Mobile sticky estimate had a heavy shadow across the extras list. | Reduced shadow only on the homepage. |
| Medium | At 601–680 px the homepage header was mobile but chat still floated over content. | Closed launcher follows the header's 680 px breakpoint. |
| Low | Selected-extras counter split its number onto a separate line on narrow forms. | Counter stays together; service label can wrap naturally. |

The mini-form composition, service page content and article layout were visually acceptable and retained. No new content, controls, dependencies or animations were introduced. Hero, apartment, videos, scrubbing, JourneyHandoff, prices and all business code remain unchanged by this polish.

## Verification

- TypeScript: PASS.
- Production build: PASS.
- ESLint on source/scripts/tests/config: 0 errors, two existing `no-img-element` warnings in unchanged website-chat.tsx.
- Existing regression: 942 tests, 916 pass, 26 environment-dependent skips, 0 fail. No new test suite.
- Current source inventory refreshed in release/ai-go-live.json; no fresh live provider/native booking certification is claimed.
- Real browser checks and screenshots: see final review evidence below.

No database writes, migrations, new Orders, customer messages or production changes were performed for this visual polish. Previous release limitations (Preview Telegram configuration and fresh source-bound native booking proof) remain documented in homepage-focused-ux.md.

## Final browser evidence

- READY Preview: https://lumaclean-f0hxsuc1k-vladislavs-projects-0eae0ea3.vercel.app/ru
- Application commit: `c36b89e2be1aecdf10e4b0e36d0023caf454f9ae`; deployment `dpl_7927vYsTgNzQUwi6VrMwCUQLPnqV`, target Preview (`null`). Later documentation-only commits do not alter the deployed source.
- Chrome homepage matrix: RU/SR/EN × 1440, 1024, 390 px. No page overflow; one main and one mini-form; seven numbered sections in agreed order. Form anchor top 99.5–100.5 px, header 82 px desktop / 62 px mobile.
- Upholstery: RU at 1440/1024/390, EN/SR at 390 px; no page/table overflow and numeric heading right aligned. Production was opened as the visual reference.
- Representative deep-cleaning service and upholstery article were visually checked at 1440/1024/390 px. Their content/layout were retained.
- Intermediate checks: EN/SR navigation at 901 px, English header at 1101 px, homepage chat at 640 px, terms at 360 px. No overflow in observed states.
- Interactions: price animation showed intermediate values before final 11,400; rapid switching ended at the correct value; 100+ band displayed 180 RSD/m², not an order total. Mobile ledger scrolled horizontally without page overflow.
- Two standard windows add 1,400 RSD and remain selected after extras close; selected counter remains readable. Standalone upholstery CTA opens `request=upholstery` with UPHOLSTERY selected. No live form submissions were made in this polish.
- Empty mini-form displays phone/consent errors without false success; fields remain readable. Focus rings and 16/18 px input text checked; compact chat opens/closes correctly. Current final Preview browser warning/error log was empty.
- Hero CTA verified by native coordinate click against the visible control: `#estimate`, form top 100.28 px. Locator auto-centering can itself advance the scroll scene during testing; that testing artifact was not treated as a website defect.
- Existing reduced-motion logic and scroll/video source are untouched; no new decorative animation, JavaScript dependency or client code was added. No fresh reduced-motion emulation or CWV/device performance measurement was performed in this CSS-only pass.

Owner review screenshots are local artifacts in `output/playwright/ui-polish/` (not application assets). Key pairs:

| Section | Before | After |
| --- | --- | --- |
| Desktop form | before-form-1440.jpg | after-form-1440.jpg |
| Tablet header EN | before-form-1024-en.jpg | after-form-1024-en.jpg |
| Price result | before-rates-1440.jpg | after-rates-1440.jpg |
| Mobile terms | before-terms-390.jpg | after-terms-390.jpg |
| Mobile upholstery | before-upholstery-390.jpg | after-upholstery-390.jpg |
| Upholstery prices | before-upholstery-table-390.jpg | after-upholstery-table-390.jpg |

Additional final states: after-form-390.jpg, after-extras-390.jpg, after-rates-390.jpg, after-rates-scroll-390.jpg, after-contact-390.jpg, check-hero-1440.jpg, and viewport-matrix.json. Before images come from ab6fabc's UX Preview; after main screenshots were rechecked on final c36b89e. The unchanged service/article checks and upholstery table detail were captured on the preceding a99454e Preview, whose relevant styles are identical.

Review is limited to Chrome's responsive viewports, representative public routes and the states above. Physical devices, every article/service and lab/field CWV were not comprehensively tested. Release requires the owner's visual approval; production was not deployed.
