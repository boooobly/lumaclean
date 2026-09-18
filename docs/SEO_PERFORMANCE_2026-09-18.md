# Performance follow-up — 2026-09-18

Commit: f9c4442.

The homepage previously requested the hidden before-cleaning image eagerly. It is now mounted on the first pointer interaction with the room. The clean poster remains visible while that image loads. No changes to layout or video behavior.

Validation: ESLint, production build (69 static pages), Chrome desktop (image absent initially, present and loaded after interacting), 390 × 844 viewport (clean poster loaded, before image absent, no horizontal overflow). Existing September 11 Lighthouse scores predate the video optimization and are not current measurements. No new Lighthouse/Core Web Vitals improvement is claimed.

Remaining performance work: fresh mobile lab measurement; weak-network video behavior and full forward/reverse journey verification. This change removes an initial image request; transferred-byte savings depend on the Next.js image variant.
