import { Temporal } from "@js-temporal/polyfill";
import { CrmError } from "./crm";
export const expenseLabels = {
  TRANSPORT: "Транспорт",
  TAXI: "Такси",
  CHEMICALS: "Химия и расходники",
  EQUIPMENT: "Инвентарь",
  MARKETING: "Реклама",
  SOFTWARE: "Сайт и сервисы",
  PAYOUT: "Историческая / внешняя выплата",
  OTHER: "Прочее",
};
export const payoutLabels = {
  PENDING: "Ожидает выплаты",
  PAID: "Выплачено",
  CANCELLED: "Отменено",
};
export function payoutSnapshot(
  finalPrice: number,
  individual: number | null,
  defaultPercent: number | null,
) {
  const percent = individual ?? defaultPercent;
  if (percent === null) return null;
  if (
    !Number.isFinite(finalPrice) ||
    finalPrice < 0 ||
    !Number.isFinite(percent) ||
    percent < 0 ||
    percent > 100
  )
    throw new CrmError("VALIDATION", "Недопустимая база или процент выплаты.");
  // Integer kopecks and basis points: deterministic half-up rounding.
  const amount =
    Math.floor(
      (Math.round(finalPrice * 100) * Math.round(percent * 100) + 5000) / 10000,
    ) / 100;
  return { basisAmount: finalPrice, appliedPercent: percent, amount };
}
export function financePeriod(
  input: { period?: string; from?: string; to?: string },
  now = new Date(),
) {
  const local = Temporal.Instant.from(now.toISOString())
    .toZonedDateTimeISO("Europe/Belgrade")
    .toPlainDate();
  let from = local.with({ day: 1 }),
    to = from.add({ months: 1 });
  if (input.period === "previous") {
    to = from;
    from = from.subtract({ months: 1 });
  }
  if (input.period === "year") {
    from = local.with({ month: 1, day: 1 });
    to = from.add({ years: 1 });
  }
  if (input.period === "custom") {
    try {
      from = Temporal.PlainDate.from(input.from!);
      to = Temporal.PlainDate.from(input.to!).add({ days: 1 });
    } catch {
      throw new CrmError("VALIDATION", "Укажите корректный диапазон дат.");
    }
    if (Temporal.PlainDate.compare(from, to) >= 0 || from.until(to).days > 3660)
      throw new CrmError(
        "VALIDATION",
        "Диапазон должен быть от 1 дня до 10 лет.",
      );
  }
  const asDate = (d: Temporal.PlainDate) =>
    new Date(
      d.toZonedDateTime({ timeZone: "Europe/Belgrade", plainTime: "00:00" })
        .epochMilliseconds,
    );
  return {
    from: asDate(from),
    to: asDate(to),
    fromLabel: from.toString(),
    toLabel: to.subtract({ days: 1 }).toString(),
  };
}
export function economics(
  revenue: number,
  expenses: { amount: number; payoutId: string | null }[],
  payouts: { amount: number; status: string }[],
) {
  const businessExpenses = expenses
    .filter((e) => !e.payoutId)
    .reduce((s, e) => s + e.amount, 0);
  const accrued = payouts
    .filter((p) => p.status !== "CANCELLED")
    .reduce((s, p) => s + p.amount, 0);
  return {
    revenue,
    businessExpenses,
    accrued,
    profit: Math.round((revenue - businessExpenses - accrued) * 100) / 100,
  };
}
