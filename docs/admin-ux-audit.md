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

## Preview findings resolved after implementation

41. Finance period disappeared with its collapsed explanation; keep the current period visible.
42. CRM columns clipped at 1024px; use labelled ledger rows through the tablet breakpoint.
43. Mobile agenda taps opened planning instead of the order; separate the order link and planning action.
44. Photo viewer keyboard focus excluded navigation controls and changed on photo selection; use a native modal dialog with Escape and thumbnail focus restoration.
45. Dashboard names exposed an internal fallback/channel enum; use client/state/phone fallbacks and channel labels.
46. Numeric CRM validation displayed default English validator text; localize the explanation while retaining every bound and precision rule.

47. The floating latest button on a paginated older history only scrolled within that page; navigate to the current conversation window instead.

All 47 recorded presentation issues are addressed. CRM fields, financial calculations, scheduling, audit records, channel diagnostics and AI operating policies remain available.

## Verification

Protected Preview `dpl_7RFpHTNvvwoVSFP75U5AEtWQcfbp`, application commit `f044746f4af14ecd5cdce1e973660f10d505ce4f`: all nine main pages at 1440×900, 1024×768, 768×1024, 430×932, 390×844 and 360×800 (54 page/viewport checks), with no unintended horizontal page overflow. Screenshots and DOM measurements are local ignored QA artifacts under `qa-output/screenshots/` and `qa-output/preview-viewports.json`.

Checked populated and empty states, long Serbian names/text, eight detail/create/edit routes, labelled tablet/mobile ledgers, agenda order navigation and separate planning dialog, seven settings groups, sticky form actions above bottom navigation, validation expanding closed sections, More sheet and focus restoration. Diagnostics, credentials, IDs, AI evaluations/tool traces, routing, histories, secondary contact fields and explanations are behind disclosures/drawers.

Messenger scenarios passed: unread Website and WhatsApp rows, phone-only names, handoff complaint banner, UNKNOWN delivery kept distinct from safe retry, empty AI chat, long bounded history and older-page/latest navigation, optional context, search, native fullscreen photo with Escape/focus restoration, authenticated PDF download, synthetic photo upload and delivered Website reply, SHADOW edit/send/hide, takeover and resume. Actions used disposable isolated Preview conversations only; no real customer transport was invoked and no production order was created.

35 targeted Node tests passed (15 admin UI/domain/validation and 20 existing transport/security/media checks); 10 isolated Preview integration assertions passed, including reply idempotency, bounded pagination and unchanged global/channel modes. Affected-file lint, typecheck and optimized production build passed. Schema/migrations are unchanged. The previous 200+ AI behavior suite was not rerun.

The final changes after the full viewport matrix are localized validation wording and the older-history latest link, covered by boundary/navigation regression checks. Both were confirmed in authenticated Preview `dpl_7uTqZcgUZJTi5hKpkV9ujdWS4sKu`, commit `7aef146971c4ecd25487dda1a23dd7b257608376`: the invalid discount automatically reveals its closed group with the Russian numeric limit; the floating latest link navigates from an older page to current history, including the delivered photo reply. Physical iOS Safari/Android Chrome soft-keyboard behavior remains unverified: Chrome viewport emulation verifies layout and composer sizing, not a physical keyboard. The implementation accounts for dynamic viewport height, visualViewport and safe-area insets.

Fixtures and their private media were removed after QA, before release. Cleanup removed 11 owned primary entities; remaining conversations, messages, attachments, jobs, notifications, orders, clients, cleaners, leads, expenses and payouts are all zero. Global and channel modes match the saved baseline. Immutable append-only audit entries for QA actions are intentionally preserved; cleanup never disables the audit trigger or changes AI modes.
