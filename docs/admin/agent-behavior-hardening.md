# Website agent behavior hardening

Website AI retains the owner-selected production mode. Telegram, WhatsApp and Viber customer AI remain OFF; existing internal Telegram handoff notifications are independent.

## Authoritative boundaries

- Female AI persona and stable conversation alias; localized AI disclosure. Human operator gender is unspecified. One bounded grammatical repair pass, with unchanged numbers, references, quoted text and remaining wording. Invalid repair cannot execute tools.
- Relative dates use the CLIENT message timestamp in BusinessSettings.timezone. Booking feasibility uses current server time. Temporal IANA rules handle Belgrade DST.
- Separate versioned limits: sameDayBookingCutoffMinute=1020 and latestCleanerDepartureMinute=1020. Exactly 17:00 is prohibited. Settings changes are audited, invalidate conversation revisions and the signed booking proof. Additive migration; no historical order recalculation.
- Today's urgency is derived from the normalized date, +20%; future dates have no fee. Quotes and recap dependencies are invalidated by explicit corrections.
- Every incoming cleaner journey is checked, including first departure from home, current operational feasibility and a final check immediately before create/update. A planned previous completion is not evidence of current position. A completed job establishes an origin; a departure from there must still reach the next job.
- Start-at, arrive-by and finish-by are separate tool intents. Finish-by includes the duration plus cleaning reserve. Vague day periods require explicit clock clarification. Cleaning reserve, 30-minute travel buffer and FALLBACK_80 are separate.

## Durable quick replies

Message.structured.replySet stores the ID, requested intent, choices, revision, creation/expiry and consumption timestamps. Message prose never generates buttons. Any meaningful CLIENT text or attachment consumes the active set under the conversation lock. A tap validates source, set, revision and stored choice, creates one idempotent CLIENT message and stores allowlisted facts before the model. Reload and SSE read the same stored projection. Handoff, owner takeover, a new assistant turn, booking and expiry invalidate the previous choices.

Existing recap confirmation and post-booking controls keep their UI. Their intents are persisted alongside the server recap; confirmation still follows the same revalidation, readiness, kill-switch and idempotent booking path.

## Exceptions and verification

Hazardous cleaning, heavy lifting, strict crew preference, unusual key custody, unconfirmed payment, cancellation, arrival queries, complaints and outside-area addresses require existing human handoff. No tool can cancel an order, invent ETA/refund commitments, access arbitrary customers or disclose secrets.

The maintained synthetic corpus contains 112 non-PII cases across 18 categories and RU, SR Latin, SR Cyrillic and EN. Targeted tests also exercise isolated Preview persistence/concurrency, persona repair, clock boundaries, correction invalidation and existing Chat V2/Telegram safety. Bounded behavior-eval is ADMIN + Preview-only, uses native primary/fallback providers separately and executes no CRM tools. Normal deterministic tests do not call paid LLMs. Logs contain only named counters and handoff reason codes, never prompts or customer details.

Release requires targeted tests, affected lint, typecheck/build, fresh Preview booking proof with scoped cleanup and main production deployment. No production test Order and no production mode change.
