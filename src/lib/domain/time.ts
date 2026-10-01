import { Temporal } from "@js-temporal/polyfill";

export function businessPeriods(now: Date, timezone: string) {
  const local = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(
    timezone,
  );
  const today = local.startOfDay();
  const month = today.with({ day: 1 });
  const asDate = (value: Temporal.ZonedDateTime) =>
    new Date(value.epochMilliseconds);
  return {
    dayFrom: asDate(today),
    dayTo: asDate(today.add({ days: 1 })),
    monthFrom: asDate(month),
    monthTo: asDate(month.add({ months: 1 })),
  };
}
