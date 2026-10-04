# Mobile accessibility follow-up — 2026-09-19

## Implemented

- Increased header language targets from about 12 × 10 px to 28 × 36 px. The narrow article header keeps 24 × 38 px targets.
- Increased footer language targets to 28 × 32 px and removed low-opacity text rendering.
- Added a darker teal text token (`#14757e`) for the small numbered labels in additional services and FAQ. Its calculated contrast is 4.76:1 on `#f3f0e9` and 5.19:1 on `#fbfaf6`.
- Increased receipt metadata opacity from 45% to 52% white on the dark receipt.
- Increased the calculator range input's touch height from 2 px to 44 px without changing its value range.
- Added a root-level reduced-motion override so anchor navigation no longer inherits smooth scrolling when the operating system requests reduced motion.

Code commit: `7348d0a`.

## Validation

- ESLint: no code errors; CSS files are outside the current ESLint configuration.
- TypeScript and production build: passed, 69 generated pages.
- Local production browser at 390 × 844:
  - no horizontal overflow;
  - fixed-header jump to `#estimate` settles with the section 70 px below the viewport top;
  - RU → SR locale navigation changes the URL, document language and active language state;
  - service selection, area slider, counted extra and checkbox extra update the estimate;
  - empty form submission shows client-side validation for name, phone and consent; no lead request was sent;
  - FAQ expansion works;
  - Telegram, Viber and WhatsApp links are 339 × 62 px and retain their configured destinations.
- Shared mobile header checked on the Serbian general-cleaning service and article index. Canonicals are present, no accidental noindex was found and the browser console had no warnings or errors.
- Reduced motion was forced in Chromium without changing the operating system setting. Confirmed: `matchMedia` is true, root scroll behavior is `auto`, the journey stage/progress are hidden, the sticky frame becomes relative and no video `src` is assigned.

### Control Lighthouse

One Lighthouse 13.4.1 mobile run was made against the local production build after the changes:

| Metric | Result |
| --- | --- |
| Performance | 86/100 |
| Accessibility | 100/100 |
| Best practices | 100/100 |
| SEO | 100/100 |
| FCP | 1.5 s |
| LCP | 4.2 s |
| TBT | 20 ms |
| CLS | 0 |
| Color contrast audit | Passed |
| Touch target audit | Passed |

This local performance result is not directly comparable with the 18 September PageSpeed production run (97/100, LCP 2.6 s). It is used to confirm the affected accessibility audits, not to claim a performance regression. A post-deployment PageSpeed API request returned Google quota error 429 and was not repeated.

The LCP element remains the text heading `Čist prostor menja sve.` The local trace attributed about 1.29 s to element render delay; TTFB was about 9 ms. Lighthouse identified three render-blocking CSS chunks of approximately 8.3, 2.6 and 4.4 KB with an estimated 670 ms opportunity. These are required page styles, font display already passes, TBT is low and the last production PageSpeed result is strong. No loading workaround or CSS inlining was added solely to improve the lab score.

## Production

- Deployment: `dpl_3UpfnDPzp5EzqnMhzV3kxG9vCNhd`, READY, aliased to <https://lumacleanrs.com>.
- Production checks returned 200 for RU/SR/EN homepages, the Serbian general-cleaning service, Serbian article index and sitemap.
- No `X-Robots-Tag` noindex was present. The sitemap still contains 63 URLs.
- Production browser at 390 × 844 confirmed the new target sizes and colors, 44 px range input height, no horizontal overflow and no console warnings or errors.

## Remaining limitation and manual iPhone check

Real iPhone Safari hardware was not available. On an iPhone, open `/sr` in Safari and verify this short sequence:

1. Confirm the hero poster appears immediately and the page scrolls normally.
2. Scroll forward through all room transitions, then back through details and bathroom to the hero; watch for a blank frame, stuck loader or wrong room label.
3. Tap RU/SR/EN, the estimate button, calculator controls, FAQ rows and each messenger link. Do not submit the lead form unless a real request is intended.
4. Enable **Settings → Accessibility → Motion → Reduce Motion**, reload the page and confirm the long room animation is replaced by the static hero and anchor jumps are immediate.

If Safari shows a blank or stuck video, record the iPhone model, iOS version, connection type and the scroll direction/section where it happened.

