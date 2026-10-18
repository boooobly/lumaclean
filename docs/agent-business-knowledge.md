# Nina business knowledge

Source: approved Google Sheet `1Xua3GrAYAgYfcbYUEWrU6I6cMZEA0IULLdSuKrbW4DY`, read live on 17 October 2026, tabs 01–06 only. The committed snapshot is public business data; source exports stay ignored under `work/`.

## Audit

Previously `getBusinessInfo` returned website copy, fourteen calculator extras and a limited upholstery table. Hundreds of approved extras, mattresses, carpets and most rules were missing. `routineFaq` repeated cash-only website wording, answered appliance inclusion questions with a price, and mistook Serbian “uključuje” for key custody. Qualification/extraction could intercept a question before the model answered it. A bathroom count was stored in Lead notes without invalidating an old quote or preventing an incomplete booking. Upholstery-only intent did not always create a Lead immediately. General renovation/quality-policy questions could unnecessarily switch the entire conversation to HUMAN_CONTROL.

## Sources and permissions

The strict snapshot contains five packages, 280 extras, 94 upholstery rows, 108 scope operations and 39 public rule interpretations. Operational norms, cost, margin, market comparisons, inactive draft fees and all tabs 07–12 are excluded. Rule interpretations preserve the approved meaning while removing internal commentary. Price zero means inclusion in a named scope; missing price is unknown. OFFERED, BY_AGREEMENT and UNAVAILABLE are separate from calculator/booking capabilities.

Read-only `searchBusinessKnowledge` normalizes Cyrillic/Latin Serbian, accents and RU/SR/EN synonyms, ranks stable codes, and returns at most five records within 6,500 characters of records. It never downloads Sheets at runtime. Relevant records only are added to the current turn. Current order tools take priority over runtime prices/rules, then knowledge, then public copy. A direct business question bypasses qualification and receives the relevant catalog facts first.

Consultation turns advertise a bounded tool subset to both existing providers and enforce that subset server-side. An optional qualification/contact follow-up requires a verified `businessAnswer` prefix: the server displays the answer first, then its existing question and saved input context. A terminal question cannot replace the requested answer. This is an internal tool argument, not a new public form field. Normal quote and booking turns keep their existing workflow. Follow-ups retain only versioned record codes, not cached prices; a minimum-visit explanation re-reads the discussed item from the current snapshot and active runtime catalog. An unknown stable code returns no substitute.

`recordKnowledgeRequest` validates current attributed CLIENT evidence and relevant approved codes, stores requested non-calculator work in the existing Lead/state, and requires specific review. It cannot create ServiceExtra or a price. Knowledge status never grants booking permission. Multiple bathrooms invalidate old quote/slots and block booking. Upholstery stays a Lead with review; no autonomous Order. Existing Website/WhatsApp runner, identity, controls and idempotency remain shared.

## Price conflicts resolved by precedence

- Live table and production both use regular 100+ rate **98 RSD/m²** (an earlier task brief said 95).
- The corner-sofa note still says 1,000 per extra seat; the project price and explicit owner confirmation say **2,000**. The snapshot uses 2,000, base 5,600 through four seats.
- RULE-GENERAL-008 says round upward; existing approved runtime rounds the 100+ calculation to the nearest 100. Do not export a conflicting rounding promise; `calculatePrice` remains authoritative.
- Draft internal travel buffers and labour norms are not customer facts and do not change scheduling.
- Holiday +20% and unsupported extras are informational/manual review only, never a fictitious complete server quote.
- Card and fiscal receipt remain unconfirmed. Current rules confirm cash RSD/EUR and bank transfer RUB at the owner's 1:1 payment rule. No unsupported cryptocurrency promise is added.

Existing calculator extras and existing upholstery keys are checked against runtime defaults, then active database tariffs at retrieval time. An existing-code mismatch returns `PRICE_CATALOG_MISMATCH`, not a stale price. All five area bands are validated. Order totals still require the shared deterministic server tool; knowledge cannot synthesize new quote lines. Output guards bind informational amounts to retrieved facts and keep slot/confirmation/refund restrictions.

Native QA also caught two structural failures: shutters mounted on windows triggered window-count qualification, and a correct English cutoff explanation was rejected when the model used 12-hour notation. Accessory mentions now require a separate explicit window-washing request before window inputs can be used. Rejected catalog writes return bounded reasons and eligible stable codes while retaining exact CLIENT evidence checks. Time validation normalizes equivalent AM/PM notation; informational cutoff explanations remain separate from actual slot promises, which still require server evidence. Retrieved Russian descriptions must be translated completely into the customer's language.

Production currently allows autonomous area-service tools only for `regular` and `deep`. Retrieval overlays calculation/booking capabilities from that current server setting. All five packages remain available for consultation; moving, Airbnb and office enquiries require the existing manual workflow. This release does not widen the allowed-service list.

## Controlled refresh and rollback

1. Read current metadata and bounded ranges through the connected Sheets reader. Check project-price headers and statuses, not old-price columns. Never export tabs 07–12 or labour/cost/market columns.
2. Save reviewed rows as `{title, rows:[{row,cells}]}` to an ignored local file. Bounds: 01 A4:H29/L4:M29; 02 A4:F284/I4:K284; 03 A4:F98/I4:J98; 04 A4:J103; 05 A4:I112; 06 A4:H9. Only allowlisted fields are emitted; no raw workbook is committed.
3. Run `npx tsx scripts/admin/sync-business-knowledge.ts work/knowledge-source.json`. A source hash and content version are generated. The importer rejects changed bounds, duplicate codes and internal financial/labour fragments. Review changes to public rule interpretations and synonyms alongside the source; there is one generated snapshot, not independent price lists.
4. Run knowledge corpus and agent regression tests, typecheck, lint, build and authenticated native Preview. Resolve runtime/knowledge differences before release. Do not mutate tariff tables, old orders, financial snapshots or channel modes.
5. To disable retrieval, set `AGENT_BUSINESS_KNOWLEDGE_ENABLED=false` and redeploy. The agent falls back to current public service descriptions and verified calculator prices, without legacy payment FAQ. Custom-work and bathroom booking guards stay active, including for already saved Leads. No model/channel-mode change, database migration or reset is required. To roll back only catalog data, restore a reviewed compatible snapshot and redeploy after consistency checks; do not revert the independent booking safeguards.

Native Preview scripts contain synthetic inquiries, no customer contact/address/confirmation, are ADMIN-only, origin-checked, rate-limited and restricted to the existing isolated Preview database. WhatsApp scenarios use the real shared ingress/jobs/runner/tools with request-local test admission; persisted Preview and production channel modes are unchanged. Connection diagnostics remain real and all outbound adapters are replaced by a no-network capture. Delivery readiness is not inferred from an AI response. Fixtures are deleted by owned namespace; append-only audits remain. No production test Orders are permitted. A complete booking release proof is separately required by the existing readiness gate.
