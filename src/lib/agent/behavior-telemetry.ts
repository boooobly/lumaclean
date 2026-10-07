// Operational counters only. Never emit client text, identifiers, prompts or contact details.
const counters = new Map<string, number>();
export function behaviorMetric(name: 'personaRepairCount' | 'sameDayCutoffRejected' | 'pastDepartureRejected' | 'staleQuickReplyRejected' | 'customerCorrectionCount' | 'repeatedQuestionDetected' | 'repeatedQualificationQuestionCount' | 'handoffBeforeQualificationComplete' | 'handoffByReason', reason?: string) {
  const key = reason ? `${name}:${reason}` : name;
  counters.set(key, (counters.get(key) ?? 0) + 1);
  console.info(JSON.stringify({ event: 'agent_behavior', metric: name, ...(reason ? { reason } : {}), count: 1 }));
}
export function behaviorCounters() { return Object.fromEntries(counters); }
