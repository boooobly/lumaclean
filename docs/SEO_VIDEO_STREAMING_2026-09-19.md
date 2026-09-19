# Progressive video loading — 2026-09-19

Replaced complete-file fetch/Blob video loading with native MP4 URLs and HTTP byte-range loading. Existing MP4 files have fast-start metadata; all six production assets returned 206 for a range request. No media re-encoding or visual changes.

Decoded-frame guards prevent exposing a video before data is available. loadeddata/canplay resume seeks after metadata arrival. Loading state clears on media failure and return to the hero. Adjacent clips initially request metadata only. Source assignment remains deferred until scrolling; cleanup removes sources and listeners.

Validation:
- ESLint, TypeScript and production build: passed, 69 static pages.
- Chrome 390 × 844, cold origin, video responses capped at 128 KiB/s: the first requested frame displayed with discontinuous buffered ranges, before the entire file arrived. Range requests observed at offsets 0, 1146880, 2818048. At the observation 16 seconds after scroll the frame was already visible; this is an upper bound, not a precise first-frame measurement. The former full-file wait was approximately 36 seconds.
- Mobile forward to kitchen, reverse through details/bathroom and back to hero: passed.
- Codex browser desktop 1365 × 900: desktop media selected and painted.
- Local 503 video proxy: poster remains, loading class clears, page remains scrollable.
- Real iOS Safari hardware was not available; retained muted, playsInline and existing first-gesture priming. No claim of device-level Safari verification.

Reproducible local slow/failure proxy: docs/seo-audit/video-test-proxy.cjs. It blocks non-read HTTP methods and is not a production route. Its bandwidth limit applies per media response, not to all page traffic.
