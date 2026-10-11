import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { dateOnly } from "@/lib/validation/scheduling";
import { entityId } from "@/lib/validation/crm";
export const repeatInput = z
  .object({
    sourceId: entityId,
    expectedUpdatedAt: z.string().datetime(),
    date: dateOnly,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    weekly: z.boolean(),
    weekdays: z.array(z.number().int().min(1).max(7)).max(7),
    until: dateOnly,
    cleanerIds: z
      .array(entityId)
      .max(20)
      .refine((v) => new Set(v).size === v.length),
    finalPrice: z
      .number()
      .finite()
      .min(0)
      .max(10000000)
      .multipleOf(0.01)
      .nullable(),
    comment: z.string().trim().max(2000),
    allowDuplicate: z.boolean().default(false),
    requestId: z.string().uuid(),
  })
  .strict();
export type RepeatInput = z.infer<typeof repeatInput>;
export function repeatDates(
  input: Pick<RepeatInput, "date" | "until" | "weekly" | "weekdays" | "time">,
) {
  const start = Temporal.PlainDate.from(input.date),
    end = Temporal.PlainDate.from(input.until);
  if (!input.weekly) return [start.toString() + "T" + input.time];
  const days = start.until(end).days;
  if (days < 0 || days > 182 || !input.weekdays.length)
    throw new Error("Выберите дни и конечную дату в пределах 26 недель.");
  const result: string[] = [];
  for (
    let date = start;
    Temporal.PlainDate.compare(date, end) <= 0;
    date = date.add({ days: 1 })
  ) {
    if (input.weekdays.includes(date.dayOfWeek))
      result.push(date.toString() + "T" + input.time);
  }
  if (!result.length || result.length > 64)
    throw new Error("Допустимо от 1 до 64 уборок за одно подтверждение.");
  return result;
}
// Desktop shortcuts never intercept selected text or editor controls.
export function calendarShortcutAllowed(
  target: Element,
  selectedText: string,
  mobile: boolean,
) {
  return (
    !mobile &&
    !selectedText &&
    !target.closest(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog',
    )
  );
}
