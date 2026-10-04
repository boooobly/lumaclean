import { z } from "zod";
import { entityId } from "./crm";
import { Temporal } from "@js-temporal/polyfill";
import { orderLabels } from "@/lib/domain/crm-types";
export const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    try {
      Temporal.PlainDate.from(v);
      return true;
    } catch {
      return false;
    }
  }, "Укажите существующую дату");
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((v) => v || null);
const percentage = z
  .number()
  .finite()
  .min(0)
  .max(100)
  .multipleOf(0.01)
  .nullable()
  .optional();
export const cleanerSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(6).max(40),
    additionalContact: text(200),
    homeAddress: text(500),
    homeLocationProof: text(2000),
    notes: text(2000),
    languages: z.array(z.string().trim().min(1).max(40)).max(15),
    skills: z.array(z.string().trim().min(1).max(60)).max(20),
    internalRating: z
      .number()
      .finite()
      .min(0)
      .max(5)
      .multipleOf(0.01)
      .nullable()
      .optional(),
    payoutPercent: percentage,
    defaultTravelMode: z.enum(["PUBLIC_TRANSIT", "WALKING", "CAR", "TAXI"]),
  })
  .strict();
const minutes = z.number().int().min(0).max(1440).nullable();
const period = z
  .object({ startMinute: minutes, endMinute: minutes })
  .superRefine((v, c) => {
    if (
      (v.startMinute === null) !== (v.endMinute === null) ||
      (v.startMinute !== null &&
        v.endMinute !== null &&
        v.startMinute >= v.endMinute)
    )
      c.addIssue({
        code: "custom",
        message: "Начало рабочего периода должно быть раньше конца",
        path: ["endMinute"],
      });
  });
const weeklyRow = z
  .object({
    weekday: z.number().int().min(1).max(7),
    working: z.boolean(),
    ...period.shape,
  })
  .strict()
  .superRefine((v, c) => {
    const r = period.safeParse(v);
    if (!r.success)
      for (const issue of r.error.issues)
        c.addIssue({
          code: "custom",
          message: issue.message,
          path: issue.path,
        });
    if (v.working && v.startMinute === null)
      c.addIssue({
        code: "custom",
        message: "Укажите часы рабочего дня",
        path: ["startMinute"],
      });
    if (!v.working && v.startMinute !== null)
      c.addIssue({
        code: "custom",
        message: "У выходного не должно быть рабочих часов",
        path: ["startMinute"],
      });
  });
export const confirmationSchema = z.object({
  acknowledged: z.array(z.string().max(300)).max(200).default([]),
  overrideReason: text(1000),
});
export const planSchema = z
  .object({
    id: entityId,
    expectedUpdatedAt: z.string().datetime({ offset: true }),
    scheduledStart: z.string().max(30).nullable(),
    manualDurationMinutes: z.number().int().min(1).max(1440).nullable(),
    durationOverrideReason: text(1000),
    requiredCleaners: z.number().int().min(1).max(20).optional(),
    cleanerIds: z
      .array(entityId)
      .max(30)
      .refine(
        (v) => new Set(v).size === v.length,
        "Клинер не должен повторяться",
      ),
    status: z
      .enum(
        Object.keys(orderLabels) as [
          keyof typeof orderLabels,
          ...Array<keyof typeof orderLabels>,
        ],
      )
      .optional(),
    source: z.enum(["EDITOR", "CALENDAR_DRAG", "UNPLACE"]).default("EDITOR"),
    ...confirmationSchema.shape,
  })
  .strict();
export const schedulingSchemas = {
  "cleaner-create": z.object({ cleaner: cleanerSchema }).strict(),
  "cleaner-update": z.object({ id: entityId, cleaner: cleanerSchema }).strict(),
  "cleaner-active": z.object({ id: entityId, active: z.boolean() }).strict(),
  "availability-week": z
    .object({
      id: entityId,
      week: z
        .array(weeklyRow)
        .length(7)
        .refine((v) => new Set(v.map((r) => r.weekday)).size === 7),
    })
    .strict(),
  "availability-date": z
    .object({
      id: entityId,
      date: dateOnly,
      kind: z.enum(["AVAILABLE", "UNAVAILABLE"]),
      ...period.shape,
      reason: text(1000),
    })
    .strict()
    .superRefine((v, c) => {
      const r = period.safeParse(v);
      if (!r.success)
        for (const issue of r.error.issues)
          c.addIssue({
            code: "custom",
            message: issue.message,
            path: issue.path,
          });
      if (v.kind === "AVAILABLE" && v.startMinute === null)
        c.addIssue({
          code: "custom",
          message: "Укажите рабочие часы",
          path: ["startMinute"],
        });
    }),
  "availability-remove": z.object({ id: entityId, date: dateOnly }).strict(),
  "order-plan": planSchema,
};
export type SchedulingCommand = keyof typeof schedulingSchemas;
