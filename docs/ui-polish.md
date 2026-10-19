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

The mini-form composition, service page content and article layout were visually acceptable and retained. No new content, controls, dependencies or animations were introduced. Hero, apartment, videos, scrubbing, JourneyHandoff, prices and all business code remain unchanged by this polish.

## Verification

- TypeScript: PASS.
- Production build: PASS.
- ESLint on source/scripts/tests/config: 0 errors, two existing `no-img-element` warnings in unchanged website-chat.tsx.
- Existing regression: 942 tests, 916 pass, 26 environment-dependent skips, 0 fail. No new test suite.
- Current source inventory refreshed in release/ai-go-live.json; no fresh live provider/native booking certification is claimed.
- Real browser checks and screenshots: see final review evidence below.

No database writes, migrations, new Orders, customer messages or production changes were performed for this visual polish. Previous release limitations (Preview Telegram configuration and fresh source-bound native booking proof) remain documented in homepage-focused-ux.md.
