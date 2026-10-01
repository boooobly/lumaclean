import type { OrderStatus } from "@/generated/prisma/enums";
export const travelLabels = {
  PUBLIC_TRANSIT: "Общественный транспорт",
  WALKING: "Пешком",
  CAR: "Автомобиль",
  TAXI: "Такси",
} as const;
export const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] as const;
export const closedStatuses: readonly string[] = [
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
];
export const releasedStatuses: readonly string[] = ["CANCELLED", "NO_SHOW"];
export type SchedulingIssue = {
  key: string;
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
  cleanerId?: string;
  orderId?: string;
};
export class SchedulingError extends Error {
  constructor(
    public issues: SchedulingIssue[],
    message = "Проверьте условия планирования",
  ) {
    super(message);
  }
}
export type CrewOption = { id: string; name: string; active: boolean };
export type CalendarOrder = {
  id: string;
  reference: string;
  client: string;
  address: string;
  service: string;
  status: OrderStatus;
  scheduleMode: "FIXED" | "FLEXIBLE";
  start: string | null;
  end: string | null;
  windowFrom: string | null;
  windowTo: string | null;
  localStart: string;
  duration: number | null;
  manualDuration: number | null;
  requiredCleaners: number;
  cleaners: CrewOption[];
  updatedAt: string;
  issues: SchedulingIssue[];
};
export type CalendarData = {
  mode: "day" | "week" | "month";
  date: string;
  from: string;
  to: string;
  days: string[];
  orders: CalendarOrder[];
  cleaners: CrewOption[];
  cleanerId: string;
  travelBuffer: number;
  truncated: boolean;
};
export const durationOf = (order: {
  manualDurationMinutes: number | null;
  estimatedDurationMinutes: number | null;
}) => order.manualDurationMinutes ?? order.estimatedDurationMinutes;
export function wallLabel(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("ru-RU", {
        timeZone: "Europe/Belgrade",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(value))
    : "Не размещено";
}
export function minuteLabel(value: number) {
  return (
    String(Math.floor(value / 60)).padStart(2, "0") +
    ":" +
    String(value % 60).padStart(2, "0")
  );
}
export function businessDate(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const get = (key: string) => parts.find((p) => p.type === key)!.value;
  return get("year") + "-" + get("month") + "-" + get("day");
}
export function businessMinute(value: string) {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Belgrade",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return (
    Number(p.find((v) => v.type === "hour")!.value) * 60 +
    Number(p.find((v) => v.type === "minute")!.value)
  );
}
export function dayLabel(value: string, weekday = false) {
  return new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    ...(weekday ? { weekday: "short" } : {}),
  }).format(new Date(value + "T12:00:00Z"));
}
