# Conversation strategy experiment

Base: `9516f2922f2a86b2d5829c26d548046614e37aad` (main after #17). No appliance extraction or catalogue changes. Production defaults, provider/model configuration and channel modes remain unchanged.

## Architecture and boundaries

Ingress still deduplicates and attributes CLIENT messages, verifies structured replies, merges explicit corrections and invalidates dependent quote/slots/recap. The existing job claim groups the unanswered burst under a conversation revision and lease. No second Conversation, CRM, tools, job, queue or outbox implementation exists.

`HYBRID` retains routine FAQ and deterministic conversion intake before the main model loop, plus bounded structured extraction for an unsupported answer to an existing question. Therefore an extraction invocation can exist even when the customer receives entirely server-generated wording. The original HYBRID native tool schema/description remains unchanged; its output cap remains 1200 and its production reasoning settings remain unchanged.

`LLM_FIRST` skips the standalone extraction call and the pre-model FAQ/intake shortcut for natural text. The same bounded native tool loop receives current confirmed state, attributed recent history and operational memory, open question, server prerequisites, temporal constraints and accumulated tool results. Native tool names are the structured decisions: FAQ, fact proposal, clarification, quote, availability, soft review or hard handoff. Free text never becomes a business command.

One native `requestCustomerInput` decision can supply an optional natural question. Server checks the intent is actually missing, validates the question topic, persona and output, then persists the existing question/choices. Invalid phrasing falls back to the server question. Fact confirmation, appliance scope, service confirmation, real slots, consent and booking recap/result always retain server wording. Explicit validated quick replies can use existing deterministic intake. Critical handoff, transparency and date/cutoff checks still precede the model.

All fact writes retain strict schemas, same-burst provenance and source evidence. Unsupported semantics remain a proposal requiring customer confirmation. The model has no authority to alter catalogue, discounts, amounts, identity, permissions, duration, crew, equipment, calendar, routes, confirmation or Order inputs. Existing tool outcomes, review/handoff, quotas, deadlines, bounded retries, idempotency, audit, revision reconciliation and output validation remain authoritative.

Private `lastDecision` records strategy, response origin and model call count. These diagnostics and structured reply provenance are excluded from customer-visible message metadata. Numeric reasoning token counts and actual provider usage.cost can be retained; reasoning content is discarded. Actual billed cost includes cache effects instead of pretending all input tokens were charged at the uncached rate.

## Reproducible evaluation

The frozen corpus contains 48 dialogues across Russian, Serbian Latin/Cyrillic and English: 16 development and 32 holdout. Each scenario has initial state, customer turns/bursts, expected facts, required/forbidden tools, allowed result and success criteria. Existing golden, conversion, takeover, continuity, safety, provider failure and scheduling suites remain separate gates.

Use a strictly isolated Preview `DATABASE_URL`; the harness refuses production, non-WEBSITE fixtures, real outbound credentials and external queue publication. Set existing `OPENROUTER_API_KEY` privately, `AI_AGENT_ENABLED=true`, `VERCEL_ENV=preview`. Do not set `VERCEL=1` for the local harness. No secrets are committed or included in reports. No quota counters are reset. Cleanup verifies fixture ownership and preserves audit/global counters.

```powershell
node --conditions=react-server --import tsx scripts/admin/agent-model-smoke.ts --live
node --conditions=react-server --import tsx scripts/admin/agent-conversation-benchmark.ts --live --split=development --strategies=HYBRID,LLM_FIRST --concurrency=4
node --conditions=react-server --import tsx scripts/admin/agent-conversation-benchmark.ts --live --split=holdout --strategies=HYBRID,LLM_FIRST --concurrency=4
node --conditions=react-server --import tsx scripts/admin/agent-blind-judge.ts --live qa-output/REPORT.json
```

The manifest freezes source/corpus/configuration hashes, model catalogue metadata/canonical versions, caps and reasoning settings. All four candidates run on the same code and business fixtures. Both OpenRouter candidates use low effort, max_tokens1600, require_parameters:true. Configured production providers do not receive these optional benchmark settings. Each benchmark run caps actual cost at $2 and calls at1500, additionally respecting existing server budgets, model/tool limits and 8/min ingress limits. A provider failure/fallback contamination is INCONCLUSIVE. Token counts, billed cost and latency are captured per actual model call and full runner turn. Local runner wall time against remote Preview DB is not deployed HTTP latency.

Deterministic judge owns fact/tool/price/state/one-response/booking assertions. A separate Gemini 3.8 Flash judge sees anonymous dialogue packets and scores six communication dimensions; it never determines business safety. Its cost is separate. Human review of disputed samples remains an explicit release gate. Failed/inconclusive attempts are retained separately from final results; development and holdout are not pooled into a winner score.

`agent-native-booking-proof.ts` reuses the existing strict Preview batch and cleanup boundary. It directs each model to emit native calls for catalogue, facts, Lead, calculator, duration, verified public address, real availability, recap and explicitly confirmed synthetic Order. This proves adapter/domain compatibility, not autonomous conversation quality. It cannot substitute for a free-dialogue booking holdout or production readiness proof. An unresolved address, missing duration, unavailable route/slot or provider error is INCONCLUSIVE.

## Rollout

Default and unknown flag values select HYBRID. Owner can experiment with `AGENT_CONVERSATION_STRATEGY=LLM_FIRST` only on an isolated Preview; returning to HYBRID is an immediate environment rollback with no DB rollback. Do not enable production AI-first or Haiku before final-source holdout, blind/human review, critical security checks and native/free-dialogue booking gates pass. Do not update the signed release evidence or live proof merely to make readiness green. If the gates fail, keep the PR draft and leave production running its existing configuration.
