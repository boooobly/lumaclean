# Admin UX audit — 6 October 2026

Baseline: production https://lumacleanrs.com, main c613d9c. Chrome authenticated by owner. Read-only inspection; no Orders created, no modes changed.

Examined dashboard, messages/list/thread with real WhatsApp history and photo, calendar, orders, leads/list/detail, clients, cleaners/list/detail, finances, settings and new order form. Sizes: 1440×900, 1024×768, 768×1024, 430×932, 390×844, 360×800. Empty orders/clients/finance are real production states. Populated order/client cases need isolated Preview fixtures.

## Baseline checklist (before implementation)

1. Mobile shell occupies ~215px above every task.
2. Frequently used sections require expanding navigation at top.
3. Navigation has no unread indicator.
4. Mobile headings and intro consume too much first-screen space.
5. Dashboard attention section follows finances.
6. Dashboard inbox follows latest leads.
7. Mobile dashboard metric numbers are oversized.
8. Dashboard repeats explanatory workflow content.
9. Dashboard notification stream duplicates handoff information.
10. Inbox AI mode controls occupy almost entire first mobile screen.
11. Inbox channel descriptions repeat settings.
12. Nine inbox filter chips are always visible.
13. Conversation rows repeat channel/mode/control/owner/order.
14. Conversation rows lack avatars and clear time/unread alignment.
15. Conversation title exposes locale and internal stage.
16. Permanent context sidebar squeezes desktop chat.
17. Mobile thread is a document instead of a bounded chat viewport.
18. Composer requires scrolling through history and management controls.
19. Client bubbles use competing tint and almost full width.
20. Message author repeats on every message.
21. History has no day separators.
22. Raw delivery enum and provider details repeat inside bubbles.
23. Shadow evaluation and tool plan crowd main thread.
24. Takeover, close, retry, mark-read and refresh compete equally.
25. Context displays empty order/handoff/contact sections.
26. No explicit jump to latest / preserve reading position pattern.
27. Mobile leads and cleaners require horizontal table scrolling.
28. CRM filters consume a large first screen.
29. Cleaner readiness checklist duplicates healthy state five times per row.
30. Calendar agenda sits below a large filter/explanation stack.
31. Tablet calendar still prioritizes wide desktop grid.
32. Finance period form precedes primary metrics on mobile.
33. Finance explanations compete with operational totals.
34. Settings page is ~14018px tall at 390px with diagnostics first.
35. Settings overflow at 360px (386px content).
36. Channel credential/webhook instructions are permanently visible.
37. Client forms show all extra contacts/terms/notes immediately.
38. Order form sticky save overlays fields and lacks safe-area/nav offset.
39. Lead details prioritize reference/normalized phone/source over contact/action.
40. Cleaner details show long address/readiness/history before daily planning.

## Verification

Implementation and post-change results will be recorded here after targeted tests and Preview QA. Physical iOS/Android keyboard behavior requires a device; Chrome viewport emulation alone does not prove it.
