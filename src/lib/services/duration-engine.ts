import { Prisma, type DurationRule } from "@/generated/prisma/client";
import {
  estimateDuration,
  type DurationInput,
  type DurationConfig,
} from "@/lib/domain/duration";
import { CrmError } from "@/lib/domain/crm";
export function durationConfig(r: DurationRule): DurationConfig {
  return {
    ...r,
    minArea: Number(r.minArea ?? 0),
    maxArea: Number(r.maxArea ?? 10000),
    referenceArea: Number(r.referenceArea),
    baseMinutes: r.baseMinutes ?? 0,
    minutesPerSquare: Number(r.minutesPerSquare ?? 0),
    soilMultipliers: r.soilMultipliers as Record<string, number>,
    extraMinutes: r.extraMinutes as Record<string, number>,
  };
}
export async function durationEstimate(
  tx: Prisma.TransactionClient,
  input: DurationInput,
) {
  return estimateDuration(
    input,
    (
      await tx.durationRule.findMany({
        where: { serviceId: input.serviceId, active: true },
      })
    ).map(durationConfig),
  );
}
export async function durationData(
  tx: Prisma.TransactionClient,
  input: DurationInput,
) {
  const result = await durationEstimate(tx, input);
  return {
    estimatedDurationMinutes: result?.estimatedDurationMinutes ?? null,
    cleaningReserveMinutes: result?.cleaningReserveMinutes ?? 0,
    durationRuleId: result?.ruleId ?? null,
    durationRuleVersion: result?.version ?? null,
    durationSnapshot: result
      ? (result as unknown as Prisma.InputJsonValue)
      : Prisma.DbNull,
  };
}
export function overrideReason(
  manual: number | null,
  estimated: number | null,
  reason: string | null | undefined,
  previous?: {
    manualDurationMinutes: number | null;
    durationOverrideReason: string | null;
  },
) {
  if (manual === null) return null;
  if (previous?.manualDurationMinutes === manual && !reason)
    return previous.durationOverrideReason;
  // Manual planning without a configured estimate is also documented.
  if (!reason?.trim() || reason.trim().length < 5)
    throw new CrmError(
      "VALIDATION",
      "Укажите причину ручной длительности: не менее 5 символов.",
      "durationOverrideReason",
    );
  void estimated;
  return reason.trim();
}
