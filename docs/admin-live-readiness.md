# Website live readiness

Branch: `codex/admin-live-readiness`, from `codex/admin-ai-go-live`.

Settings offers explicit owner confirmation for Regular 1–100 m² / two cleaners / 150 minutes and Deep 40–60 m² / two cleaners / 480 minutes. These are bounded starting guides, not a universal duration formula. A visible, editable 10-minute cleaning reserve is a proposal only; confirmation creates an active version through the existing finance command and append-only AuditLog. Travel buffer remains separate. Every extra starts as NULL. Partial estimates without an explicit unknown-extra reserve cannot enter automatic scheduling; orders without extras remain configured.

Cleaner readiness requires active status, contacts, a recurring weekly schedule, starting address and valid coordinates. Payout percentage and languages remain warnings. Existing address controls require an explicit result selection and signed Google location proof. Nothing silently geocodes imported addresses.

Settings groups readiness into five mandatory systems and links blockers to their repair UI. Real diagnostics retain primary/fallback and Places New checks. TRANSIT verifies Compute Route Matrix (the planner's actual dependency) and exposes only allowlisted Google error codes. Browser Maps JavaScript is tested with an actual map on the current domain; authentication errors appear visibly. Demo keys remain Preview-only and cannot satisfy the matrix billing blocker.

## Preview test and activation

Live test requires `VERCEL_ENV=preview`, a minimum 32-character `AI_LIVE_TEST_SECRET`, and `AI_LIVE_TEST_DATABASE_HOST` exactly matching the configured Neon DATABASE_URL after removing the pooler suffix. Production cannot run this command, even with a forged client request. Shared proof signing secret is present only on the server in Preview and Production.

Only an authenticated owner can start a test after hard prerequisites pass. Primary LLM qualifies the explicit synthetic request through its native calculatePrice tool. The controlled driver then uses the existing agent tool boundary for production pricing, duration, real Places selection, real TRANSIT-dependent scheduling, an opaque slot token, revalidation, the real Website confirmation-ingress logic, and creation of a Preview order. No mock providers are installed in runtime. The synthetic destination is public Terazije 1, explicitly chosen by the test driver; existing customer addresses are untouched.

The server registers a unique five-minute AgentLiveTest namespace and a conversation with no anonymous session token. Only its leased tool context can execute the test in AUTO while global SHADOW remains unchanged. Public workers/clients cannot request this override. External notifications are suppressed for this namespace. Cleanup validates the exact batch, conversation, synthetic client and scoped slot/order ownership; it removes only batch operational records. Append-only audit and the sanitized test report remain. Interrupted batches are reconciled on the next test; unsafe cleanup fails closed and never produces a passed proof.

A passed and fully cleaned test produces a signed report. The owner transfers that report to Production Settings. Signature, seven-day expiry, source fingerprint, approved rules, active crew/schedules, workday, buffer, models and Google server key must match. Preview and Production therefore need the same approved configuration for activation. A demo-key test cannot certify a different production key. This intentionally prevents stale or fabricated test reports from enabling AUTO.

Only the owner's explicit action enables limited Website AUTO. Telegram/WhatsApp/Viber remain OFF. Existing exception handoffs remain. Both one-action SHADOW and OFF controls work without deploy. Booking serializes its side-effect boundary with the mode lock and rereads mode/revision/lease and AUTO readiness immediately before the first CRM mutation.

## Verification

`tests/agent/live-readiness.test.ts`: 15 targeted tests, including real Postgres on an isolated Neon child branch. Unit tests cover authenticated proof/tampering/expiry, environment/database isolation, duration/extras and cleaner readiness. Database tests cover owner duration activation/audit, distinct duration versus crew blockers, Google blocking, forged AUTO, namespace ownership, kill switch changed during slot checks, real atomic booking under a test namespace and full cleanup/count preservation. Routing responses are explicitly mocked only in this isolated verification test; this does not create a signed live proof.

Release evidence carries forward prior baseline verification and records only the new targeted suite. Production is kept SHADOW. Real live booking remains blocked while actual Google matrix/approved duration/crew prerequisites are missing.
