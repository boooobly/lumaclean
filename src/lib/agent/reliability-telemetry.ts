import type {AgentState} from './contracts';
export const reliabilityMetrics=['factExtractionFailure','multipleExtrasExtraction','repeatedQuestion','conversationLoop','factCorrection','quoteAfterCustomerPriceRequest','quoteFailure','toolArgumentFailure','safeRecovery','handoffBeforeQuote'] as const;
export type ReliabilityMetric=typeof reliabilityMetrics[number];
/** Durable, bounded operational counts. No text, contact, prompt or identity payload. */
export function reliabilityCount(state:AgentState,key:ReliabilityMetric,amount=1){
 state.reliability??={};state.reliability[key]=Math.min(1000000,(state.reliability[key]??0)+amount);
}
