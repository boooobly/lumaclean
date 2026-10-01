import { CrmError } from "./crm";
export type DurationInput = {
  serviceId: string;
  area: number;
  soilLevel: string;
  requiredCleaners: number;
  extras: { code: string; quantity: number }[];
};
export type DurationConfig = {
  id: string;
  serviceId: string;
  version: number;
  active: boolean;
  minArea: number;
  maxArea: number;
  cleanerCount: number;
  referenceArea: number;
  baseMinutes: number;
  minutesPerSquare: number;
  soilMultipliers: Record<string, number>;
  extraMinutes: Record<string, number>;
  reserveMinutes: number;
};
export function estimateDuration(
  input: DurationInput,
  rules: DurationConfig[],
) {
  const matches = rules.filter(
    (r) =>
      r.active &&
      r.serviceId === input.serviceId &&
      input.requiredCleaners === r.cleanerCount &&
      input.area >= r.minArea &&
      input.area <= r.maxArea,
  );
  if (!matches.length) return null;
  if (matches.length !== 1)
    throw new CrmError(
      "VALIDATION",
      "Правила длительности пересекаются. Проверьте настройки.",
    );
  const r = matches[0],
    multiplier = r.soilMultipliers[input.soilLevel];
  if (!Number.isFinite(multiplier) || multiplier <= 0)
    throw new CrmError("VALIDATION", "Для загрязнения не задан коэффициент.");
  const selected = input.extras.filter((e) => e.quantity > 0);
  if (selected.some((e) => r.extraMinutes[e.code] === undefined)) return null;
  const areaMinutes =
    Math.max(0, input.area - r.referenceArea) * r.minutesPerSquare;
  const extraMinutes = selected.reduce(
    (sum, e) => sum + r.extraMinutes[e.code] * e.quantity,
    0,
  );
  const raw = (r.baseMinutes + areaMinutes) * multiplier + extraMinutes;
  const estimatedDurationMinutes = Math.ceil(raw / 5) * 5;
  if (!Number.isFinite(raw) || raw <= 0 || estimatedDurationMinutes > 1440)
    throw new CrmError(
      "VALIDATION",
      "Оценка выходит за пределы 1–1440 минут. Измените правило или параметры заказа.",
    );
  return {
    estimatedDurationMinutes,
    cleaningReserveMinutes: r.reserveMinutes,
    ruleId: r.id,
    version: r.version,
    input,
    factors: {
      baseMinutes: r.baseMinutes,
      areaMinutes,
      soilMultiplier: multiplier,
      extraMinutes,
      roundingMinutes: 5,
    },
    explanation: `База ${r.baseMinutes} мин + площадь ${areaMinutes.toFixed(1)} мин; загрязнение ×${multiplier}; дополнения ${extraMinutes} мин. Округление вверх до 5 мин. Команда: ${r.cleanerCount}.`,
  };
}
export function actualDuration(
  assignments: {
    startedAt: Date | null;
    finishedAt: Date | null;
    removedAt: Date | null;
  }[],
) {
  const active = assignments.filter((a) => a.removedAt === null);
  if (
    !active.length ||
    active.some(
      (a) => !a.startedAt || !a.finishedAt || a.finishedAt <= a.startedAt,
    )
  )
    return null;
  return Math.ceil(
    (Math.max(...active.map((a) => a.finishedAt!.getTime())) -
      Math.min(...active.map((a) => a.startedAt!.getTime()))) /
      60000,
  );
}
export function durationAccuracy(
  rows: { service: string; planned: number; actual: number; band: string }[],
) {
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const key = r.service + " · " + r.band;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups].map(([group, items]) => {
    const n = items.length,
      mean = items.reduce((s, r) => s + r.actual - r.planned, 0) / n;
    return {
      group,
      n,
      meanError: mean,
      meanAbsoluteError:
        items.reduce((s, r) => s + Math.abs(r.actual - r.planned), 0) / n,
      underestimated: items.filter((r) => r.actual > r.planned).length,
      overestimated: items.filter((r) => r.actual < r.planned).length,
      recommendation:
        n >= 8 && Math.abs(mean) >= 15
          ? `Проверьте правило: ${mean > 0 ? "недооценка" : "переоценка"} в среднем ${Math.round(Math.abs(mean))} мин (n=${n}).`
          : null,
    };
  });
}
