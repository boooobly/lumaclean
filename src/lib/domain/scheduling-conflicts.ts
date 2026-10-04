import { Temporal } from "@js-temporal/polyfill";
import {
  durationOf,
  releasedStatuses,
  type SchedulingIssue,
} from "./scheduling-types";
export const BUSINESS_ZONE = "Europe/Belgrade";
export type PlanningOrder = {
  id: string;
  addressId?: string;
  status: string;
  scheduleMode: "FIXED" | "FLEXIBLE";
  scheduledStart: Date | null;
  windowFrom: Date | null;
  windowTo: Date | null;
  manualDurationMinutes: number | null;
  estimatedDurationMinutes: number | null;
  requiredCleaners: number;
  travelBufferMinutes: number;
  cleaningReserveMinutes: number;
  cleanerIds: string[];
};
export type Availability = {
  kind: "WEEKLY" | "AVAILABLE" | "UNAVAILABLE";
  weekday: number | null;
  date: Date | null;
  startMinute: number | null;
  endMinute: number | null;
};
export type PlanningCleaner = {
  id: string;
  active: boolean;
  availability: Availability[];
};
export function plannedEnd(order: PlanningOrder) {
  const duration = durationOf(order);
  return order.scheduledStart && duration !== null
    ? new Date(order.scheduledStart.getTime() + duration * 60000)
    : null;
}
export function plainDate(value: Date) {
  return Temporal.Instant.from(value.toISOString())
    .toZonedDateTimeISO(BUSINESS_ZONE)
    .toPlainDate();
}
export function localDayStart(date: string) {
  return new Date(
    Temporal.PlainDate.from(date).toZonedDateTime({
      timeZone: BUSINESS_ZONE,
      plainTime: "00:00",
    }).epochMilliseconds,
  );
}
function boundary(
  day: Temporal.PlainDate,
  minute: number,
  edge: "start" | "end",
) {
  const date = minute === 1440 ? day.add({ days: 1 }) : day;
  const time = minute === 1440 ? 0 : minute;
  return Temporal.ZonedDateTime.from(
    {
      timeZone: BUSINESS_ZONE,
      year: date.year,
      month: date.month,
      day: date.day,
      hour: Math.floor(time / 60),
      minute: time % 60,
    },
    { disambiguation: edge === "start" ? "compatible" : "later" },
  ).epochMilliseconds;
}
function overlaps(a: number, b: number, c: number, d: number) {
  return a < d && c < b;
}
export class SchedulingConflictService {
  static check(
    order: PlanningOrder,
    cleaners: PlanningCleaner[],
    others: PlanningOrder[],
    defaultBuffer = 30,
  ): SchedulingIssue[] {
    if (releasedStatuses.includes(order.status) || order.status === "COMPLETED")
      return [];
    const issues: SchedulingIssue[] = [],
      start = order.scheduledStart?.getTime(),
      end = plannedEnd(order)?.getTime();
    const issue = (
      code: string,
      message: string,
      severity: "ERROR" | "WARNING" = "WARNING",
      cleanerId?: string,
      orderId?: string,
    ) => {
      // A confirmation is tied to the current warning text, not just its category.
      let fingerprint = 2166136261;
      for (const char of message)
        fingerprint = Math.imul(fingerprint ^ char.charCodeAt(0), 16777619);
      const key = [
        code,
        cleanerId || "",
        orderId || "",
        order.scheduledStart?.toISOString() || "unplaced",
        String(durationOf(order)),
        String(fingerprint >>> 0),
      ].join(":");
      if (!issues.some((i) => i.key === key))
        issues.push({ key, code, message, severity, cleanerId, orderId });
    };
    if (order.cleanerIds.length < order.requiredCleaners)
      issue(
        "UNDERSTAFFED",
        "Назначено " +
          order.cleanerIds.length +
          " / требуется " +
          order.requiredCleaners,
      );
    if (durationOf(order) === null)
      issue(
        "DURATION_UNKNOWN",
        "Длительность не задана — пересечения и завершение проверить полностью нельзя.",
      );
    if (order.scheduleMode === "FLEXIBLE" && start !== undefined) {
      if (end === undefined)
        issue(
          "FLEX_DURATION",
          "Для размещения гибкого заказа задайте длительность.",
          "ERROR",
        );
      else if (
        !order.windowFrom ||
        !order.windowTo ||
        start < order.windowFrom.getTime() ||
        end > order.windowTo.getTime()
      )
        issue(
          "FLEX_WINDOW",
          "Начало и завершение должны укладываться в согласованное окно.",
          "ERROR",
        );
    }
    if (start === undefined) return issues;
    for (const id of order.cleanerIds) {
      const cleaner = cleaners.find((c) => c.id === id);
      if (!cleaner) {
        issue("CLEANER_MISSING", "Клинер не найден.", "ERROR", id);
        continue;
      }
      if (!cleaner.active)
        issue(
          "CLEANER_INACTIVE",
          "Сохранённое назначение относится к неактивному клинеру.",
          "WARNING",
          id,
        );
      if (end !== undefined) {
        const first = plainDate(order.scheduledStart!),
          last = plainDate(new Date(end - 1));
        let day = first;
        for (
          let n = 0;
          Temporal.PlainDate.compare(day, last) <= 0 && n < 366;
          n++, day = day.add({ days: 1 })
        ) {
          const from = Math.max(start, localDayStart(day.toString()).getTime()),
            to = Math.min(
              end,
              localDayStart(day.add({ days: 1 }).toString()).getTime(),
            );
          const dated = cleaner.availability.filter(
            (r) => r.date?.toISOString().slice(0, 10) === day.toString(),
          );
          const weekly = cleaner.availability.filter(
            (r) => r.kind === "WEEKLY" && r.weekday === day.dayOfWeek,
          );
          const override = dated.filter((r) => r.kind === "AVAILABLE");
          const periods = override.length ? override : weekly;
          if (
            dated.some(
              (r) =>
                r.kind === "UNAVAILABLE" &&
                (r.startMinute === null ||
                  overlaps(
                    from,
                    to,
                    boundary(day, r.startMinute, "start"),
                    boundary(day, r.endMinute!, "end"),
                  )),
            )
          ) {
            issue(
              "DATE_OFF",
              "У клинера исключение / выходной " +
                day.toString() +
                ". Требуется явное подтверждение.",
              "WARNING",
              id,
            );
          }
          const hasHours = periods.some(
            (r) =>
              r.startMinute !== null &&
              r.endMinute !== null &&
              from >= boundary(day, r.startMinute, "start") &&
              to <= boundary(day, r.endMinute, "end"),
          );
          if (
            !hasHours &&
            !dated.some(
              (r) => r.kind === "UNAVAILABLE" && r.startMinute === null,
            )
          ) {
            const configured =
              cleaner.availability.some((r) => r.kind === "WEEKLY") ||
              override.length > 0;
            issue(
              configured ? "OUTSIDE_HOURS" : "AVAILABILITY_UNKNOWN",
              configured
                ? "Уборка выходит за рабочие часы " + day.toString() + "."
                : "Рабочий график клинера не задан.",
              "WARNING",
              id,
            );
          }
        }
      }
      for (const other of others) {
        if (
          other.id === order.id ||
          releasedStatuses.includes(other.status) ||
          !other.cleanerIds.includes(id) ||
          !other.scheduledStart
        )
          continue;
        const otherStart = other.scheduledStart.getTime(),
          otherEnd = plannedEnd(other)?.getTime();
        if (end === undefined || otherEnd === undefined) {
          issue(
            "OTHER_DURATION_UNKNOWN",
            "У связанного заказа длительность неизвестна; конфликт нельзя исключить.",
            "WARNING",
            id,
            other.id,
          );
          continue;
        }
        const busyEnd = end + order.cleaningReserveMinutes * 60000,
          otherBusyEnd = otherEnd + other.cleaningReserveMinutes * 60000;
        if (overlaps(start, busyEnd, otherStart, otherBusyEnd))
          issue(
            "OVERLAP",
            "Два заказа пересекаются у одного клинера.",
            "ERROR",
            id,
            other.id,
          );
        else {
          const gap =
            start >= otherBusyEnd ? start - otherBusyEnd : otherStart - busyEnd;
          const buffer =
            Math.max(defaultBuffer, order.travelBufferMinutes, other.travelBufferMinutes) *
            60000;
          if (gap < buffer)
            issue(
              "OPERATING_GAP",
              "Промежуток между уборками меньше операционного буфера. Дорога не проверена.",
              "WARNING",
              id,
              other.id,
            );
        }
      }
    }
    return issues;
  }
}
export function calendarRange(mode: "day" | "week" | "month", date: string) {
  const anchor = Temporal.PlainDate.from(date);
  let first = anchor,
    days = 1;
  if (mode === "week") {
    first = anchor.subtract({ days: anchor.dayOfWeek - 1 });
    days = 7;
  }
  if (mode === "month") {
    const month = anchor.with({ day: 1 });
    first = month.subtract({ days: month.dayOfWeek - 1 });
    days = 42;
  }
  return {
    days: Array.from({ length: days }, (_, i) =>
      first.add({ days: i }).toString(),
    ),
    from: localDayStart(first.toString()),
    to: localDayStart(first.add({ days }).toString()),
  };
}
