// Contract for a later scheduling engine. No empirical formula is assumed here.
export type DurationInput = {
  serviceCode: string;
  area: string;
  soilLevel: string | null;
  cleanerCount: number;
  extras: { code: string; quantity: string }[];
};
export type DurationEstimate =
  | { status: "UNCONFIGURED"; reason: string }
  | {
      status: "CALCULATED";
      minutes: number;
      ruleId: string;
      ruleVersion: number;
    };

export interface SchedulingEngine {
  estimateDuration(input: DurationInput): Promise<DurationEstimate>;
}

export function payoutPercent(
  cleanerPercent: string | null,
  defaultPercent: string | null,
) {
  return cleanerPercent ?? defaultPercent;
}
