import { z } from "zod";
import { serviceIds, extrasPrices } from "@/lib/pricing";
import {
  channelLabels,
  leadLabels,
  orderLabels,
  soilLabels,
} from "@/lib/domain/crm-types";
import { quantityExtras } from "@/lib/domain/crm-pricing";
import { entrySources } from "@/lib/analytics";
const keys = <T extends Record<string, string>>(labels: T) =>
  Object.keys(labels) as [
    Extract<keyof T, string>,
    ...Extract<keyof T, string>[],
  ];

const text = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max, `Не более ${max} символов`)
    .nullable()
    .optional()
    .transform((v) => v || null);
export const entityId = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/);
const optionalId = entityId.nullable().optional();
const number = (min: number, max: number) =>
  z
    .number({ error: "Введите число" })
    .finite("Введите конечное число")
    .min(min, `Значение должно быть не меньше ${min}`)
    .max(max, `Значение должно быть не больше ${max}`)
    .multipleOf(0.01, "Допустимо не более двух знаков после запятой");
export const extrasSchema = z
  .array(
    z
      .object({
        code: z.enum(
          Object.keys(extrasPrices) as [
            keyof typeof extrasPrices,
            ...Array<keyof typeof extrasPrices>,
          ],
        ),
        quantity: number(0, 100).refine(
          (v) => Number.isInteger(v),
          "Количество должно быть целым",
        ),
      })
      .strict(),
  )
  .max(10)
  .refine(
    (items) => new Set(items.map((e) => e.code)).size === items.length,
    "Услуги не должны повторяться",
  )
  .refine(
    (items) =>
      items.every(
        (e) =>
          (quantityExtras as readonly string[]).includes(e.code) ||
          e.quantity <= 1,
      ),
    "Для этой услуги допустимо 0 или 1",
  );
export const clientSchema = z
  .object({
    name: z.string().trim().min(2, "Укажите имя").max(100),
    phone: z.string().trim().min(6, "Укажите телефон").max(40),
    telegram: text(200),
    whatsapp: text(200),
    viber: text(200),
    preferredChannel: z.enum(keys(channelLabels)).nullable().optional(),
    notes: text(),
    individualTerms: text(),
    discountPercent: number(0, 100).default(0),
  })
  .strict();
export const addressSchema = z
  .object({
    label: text(100),
    fullAddress: z.string().trim().min(5, "Укажите полный адрес").max(500),
    apartment: text(60),
    floor: text(60),
    intercom: text(100),
    comment: text(),
    locationProof: text(2000),
  })
  .strict();
export const scheduleSchema = z
  .object({
    scheduleMode: z.enum(["FIXED", "FLEXIBLE"]),
    scheduledStart: text(30),
    windowFrom: text(30),
    windowTo: text(30),
  })
  .superRefine((v, ctx) => {
    const issue = (field: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [field], message });
    if (v.scheduleMode === "FIXED" && !v.scheduledStart)
      issue("scheduledStart", "Укажите дату и время");
    if (v.scheduleMode === "FLEXIBLE" && (!v.windowFrom || !v.windowTo))
      issue("windowFrom", "Укажите начало и конец окна");
  });
export const orderSchema = z
  .object({
    service: z.enum(serviceIds),
    area: number(1, 10000),
    soilLevel: z.enum(keys(soilLabels)).default("NORMAL"),
    urgent: z.boolean().default(false),
    extras: extrasSchema.default([]),
    requiredCleaners: number(1, 30).int().default(1),
    manualDurationMinutes: number(1, 1440).int().nullable().optional(),
    durationOverrideReason: text(1000),
    finalPrice: number(0, 10000000).nullable().optional(),
    priceChangeReason: text(1000),
    clientComment: text(),
    internalComment: text(),
    ...scheduleSchema.shape,
  })
  .strict()
  .superRefine((v, ctx) => {
    const result = scheduleSchema.safeParse(v);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({
          code: "custom",
          path: issue.path,
          message: issue.message,
        });
  });
export const orderCreateSchema = z
  .object({
    clientId: optionalId,
    newClient: clientSchema.nullable().optional(),
    addressId: optionalId,
    newAddress: addressSchema.nullable().optional(),
    leadId: optionalId,
    allowDuplicate: z.boolean().default(false),
    requestId: z.uuid(),
    suggestedCleanerIds: z.array(entityId).max(20).refine(ids=>new Set(ids).size===ids.length).default([]),
    order: orderSchema,
  })
  .strict()
  .refine(
    (v) => Boolean(v.clientId) !== Boolean(v.newClient),
    "Выберите клиента или создайте нового",
  )
  .refine(
    (v) => Boolean(v.addressId) !== Boolean(v.newAddress),
    "Выберите адрес или добавьте новый",
  );
export const manualLeadSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(6).max(40),
    service: z.enum(serviceIds),
    area: number(1, 10000).nullable().optional(),
    locale: z.enum(["ru", "sr", "en"]).default("ru"),
    channel: z.enum(keys(channelLabels)).default("MANUAL"),
    comment: text(),
    internalNote: text(),
  })
  .strict();
export const websiteLeadSchema = z
  .object({
    submissionId: z.uuid(),
    name: z.string().trim().min(2).max(100),
    phone: z.string().trim().min(6).max(40),
    comment: text(1000),
    estimate: text(3000),
    locale: z.enum(["ru", "sr", "en"]),
    service: z.enum(serviceIds),
    area: number(25, 180),
    urgent: z.boolean(),
    extras: extrasSchema,
    consent: z.literal(true),
    attribution: z
      .object({ landing: z.string().max(200), source: z.enum(entrySources) })
      .strict()
      .optional(),
  })
  .strict();
export const commandSchemas = {
  "lead-create": manualLeadSchema,
  "lead-status": z
    .object({
      id: entityId,
      status: z.enum(keys(leadLabels)),
      reason: text(1000),
    })
    .strict(),
  "lead-note": z.object({ id: entityId, note: text() }).strict(),
  "lead-link": z.object({ id: entityId, clientId: entityId }).strict(),
  "client-create": z
    .object({
      client: clientSchema,
      leadId: optionalId,
      allowDuplicate: z.boolean().default(false),
    })
    .strict(),
  "client-update": z.object({ id: entityId, client: clientSchema }).strict(),
  "address-create": z
    .object({ clientId: entityId, address: addressSchema })
    .strict(),
  "address-update": z
    .object({ id: entityId, clientId: entityId, address: addressSchema })
    .strict(),
  "address-active": z
    .object({ id: entityId, clientId: entityId, active: z.boolean() })
    .strict(),
  "order-create": orderCreateSchema,
  "order-update": z
    .object({
      id: entityId,
      addressId: entityId.optional(),
      order: orderSchema,
      acknowledged: z.array(z.string().max(300)).max(200).default([]),
      overrideReason: text(1000),
    })
    .strict(),
  "order-status": z
    .object({
      id: entityId,
      status: z.enum(keys(orderLabels)),
      reason: text(1000),
    })
    .strict(),
};
export type CommandName = keyof typeof commandSchemas;
