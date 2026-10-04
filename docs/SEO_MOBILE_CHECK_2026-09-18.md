# Mobile performance and slow-video check — 2026-09-18

## Production mobile measurement

PageSpeed Insights: https://pagespeed.web.dev/analysis/https-lumacleanrs-com-sr/o2pqz36wr6?form_factor=mobile

Measured /sr at 19:44 GMT+2 with Lighthouse 13.4.1, emulated Moto G Power, slow 4G, initial navigation:

| Metric | Result |
| --- | --- |
| Performance | 97/100 |
| Accessibility | 93/100 |
| Best practices | 100/100 |
| SEO audit | 100/100 |
| FCP | 1.1 s |
| LCP | 2.6 s |
| Total Blocking Time | 10 ms |
| CLS | 0 |
| Speed Index | 1.9 s |

No CrUX field data available. This is one lab run, not proof of real-user Core Web Vitals or search rankings. The September 11 local Lighthouse run used a different environment/version, so do not attribute the difference to a single recent change.

Remaining findings: render-blocking requests (estimated 970 ms), unused JavaScript (27 KiB), contrast and touch-target accessibility findings. Treat estimates as diagnostics, not guaranteed gains.

## Slow-video scenario

Local production build, Chrome viewport 390 × 844. A local proxy capped MP4 response bodies at 128 KiB/s (approximately 1 Mbit/s); other resources were not throttled. This isolates video delivery, not a complete mobile-network/CPU simulation. No lead submission or production analytics event was generated.

No video sources are attached on initial navigation. Scrolling requests the mobile clip. The current fetch-to-Blob implementation waits for a complete file before decoding: the first mobile clip is 4,667,412 bytes, requiring about 36 seconds at this cap. While waiting, a still image remains visible. The loading indicator clears when the decoded frame is ready.

The main remaining media opportunity is reducing full-file wait for slow connections. Evaluate smaller mobile clips or progressive/range loading with forward/backward seeking tests before changing production playback.

Forward navigation reached the kitchen once clip 3 loaded (readyState 4). Reverse navigation correctly selected clip 3 at the details boundary and clip 2 at the bathroom boundary; returning to scroll position 0 restored the living-room hero. No console errors or horizontal overflow were observed. During a pending clip, the previously decoded frame stays visible, so the phase label can name the next room before its image appears. The fixed estimate link remains available. All three mobile downloads completed (4,667,412 / 2,553,201 / 4,785,819 bytes).

Both requested diagnostic steps are complete. No playback changes or new production deployment were made during this follow-up. Progressive loading/compression remains a separate implementation task, with iOS seeking compatibility to verify.
