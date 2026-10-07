# Agent conversion hardening

Scope: the 7 October 2026 Serbian sales incident, investigated read-only. The real conversation, messages and lead are not modified. No pricing, duration or routing rules and no production channel modes are changed.

Production findings:

- The parser had no generalno/generalka vocabulary; the service question therefore ignored the first explicit request.
- The old Serbian service template used dubinsko, which the customer associated with beds/carpets. Uncertain service language had no confirmation state. Tool evidence accepted a substring instead of validating the whole customer message, allowing uncertainty to be omitted.
- Windows, quantities, weekend, neighborhood, crew and operational notes had no durable extraction. The partial appliance refusal was not recognized; extras remained unconfirmed and were asked again.
- Generic bez dodatnih usluga overwrote extras. There was no separate requested-but-unquantified window selection.
- Both attempts to record the window quantities failed CUSTOMER_FACTS_REQUIRED. The resulting requestHumanHandoff had reason TOOL_ERRORS, not a failed pricing calculation.
- HUMAN_CONTROL made later jobs finish without generating an answer, including the SMS/phone offers. The lead and needsAttention existed; no order existed. Shadow state was empty and the previous qualification reply sets were consumed.
- Production has active standardWindow and largeWindow, but no roletne rule. Large windows are already subject to price review. These restrictions remain.

Changes:

- Serbian apartment labels match the existing public business content: Održavajuće čišćenje / Generalno čišćenje. Generalno, generalka and Serbian Cyrillic map to deep; ambiguous detaljno requires apartment context.
- Doubt and explanation requests preserve service and require an explicit confirmation. Confirmation explanations use the public service descriptions. Full-message evidence validation prevents clipping away uncertainty.
- Specific selections survive generic refusal. Named refusals remove only their category. Window selection and missing quantity/type are separate, and mala maps to standardWindow. Serbian word counts and targeted RU/EN forms are supported.
- New facts stay in the existing conversation JSON; no CRM/schema expansion. Weekend dates are anchored to the customer timestamp in Europe/Belgrade. Banovo brdo is a neighborhood hint, not verified coordinates. Crew, one bathroom and absent carpets are notes/preferences.
- Soft review uses the existing HumanHandoff/notification tables with SOFT reasons, retaining AI_CONTROL and needsAttention. The owner can claim the conversation through the existing Inbox/Telegram action. Taking ownership or acknowledging a review does not approve custom pricing; unresolved custom facts remain blocked at the atomic booking boundary. Exceptional work and critical failures retain hard handoff.
- Known quote lines come from the existing calculator. With 57 m² and 5 large + 2 standard windows: windows 7,800 RSD; general subtotal 18,500 RSD or regular subtotal 12,400 RSD. Roletne is pending, never included as a fabricated price. Ordinary large-window review is still required.
- Explicit SMS preference and Serbian phone forms are recorded; the phone updates the lead without verifying identity. The reply promises only to pass the preference to the team, never an automatic or guaranteed SMS.
- Repeated known qualification attempts are rejected and measured. Handoff before complete qualification is measured separately.
- Hosted replay also found that an unrelated neighborhood reply repeated an unanswered extras question. The deterministic intake now uses the saved inbound question context, acknowledges the new fact and preserves the previous response context without repeating the question.

Verification:

- Targeted parser, precedence, quote, persona, time, quick reply, corpus, release and provider checks; native Preview incident replay and existing behavior integration suite.
- Preview fixtures assert AI_CONTROL, lead/contact persistence, attention/notification, no repeated known extras request, no clipped uncertain correction, no premature hard handoff, exact quote lines, and REVIEW_REQUIRED before any Order.
- Fixtures are explicitly restricted to the isolated Preview host and cleaned. No test production Order.
- One unchanged legacy Telegram provider test expects update_id instead of the transport's existing chat/message ID; excluded by exact test name and documented, not claimed as passed. The release fixture was updated to include the immutable inputs already required by the release verifier.
- An additional exploratory go-live check still expects WHATSAPP AUTO to be forbidden. Both that test and its settings schema are unchanged from current main, which already supports it; this obsolete assertion is outside the targeted conversion suite and was not claimed as passed.
- The tested-source release fingerprint must be refreshed before deployment. Native booking proof is tied to the source fingerprint and must also be renewed through the existing Preview live-test/import path; never bypass its guard.

Hosted Preview replay and release details are recorded in the PR and final report.
