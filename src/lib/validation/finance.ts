import { z } from "zod";
import { entityId, extrasSchema } from "./crm";
import { dateOnly } from "./scheduling";
import { expenseLabels } from "@/lib/domain/finance";
import { serviceIds, extrasPrices } from "@/lib/pricing";
const money = z.number().finite().min(0).max(10000000).multipleOf(0.01);
const reason = z.string().trim().min(5).max(1000);
const percent = z.number().finite().min(0).max(100).multipleOf(0.01).nullable();
export const expenseInput = z
  .object({
    date: dateOnly,
    category: z.enum(
      Object.keys(expenseLabels) as [
        keyof typeof expenseLabels,
        ...Array<keyof typeof expenseLabels>,
      ],
    ),
    amount: money,
    description: z.string().trim().min(2).max(1000),
    orderId: entityId.nullable(),
  })
  .strict();
export const durationRuleInput = z
  .object({
    service: z.enum(serviceIds),
    previousId: entityId.nullable().default(null),
    active: z.boolean().default(false),
    minArea: z.number().min(1).max(10000),
    maxArea: z.number().min(1).max(10000),
    referenceArea: z.number().min(0).max(10000),
    cleanerCount: z.number().int().min(1).max(30),
    baseMinutes: z.number().int().min(1).max(1440),
    minutesPerSquare: z.number().finite().min(0).max(1440).multipleOf(0.0001),
    reserveMinutes: z.number().int().min(0).max(240),
    soilMultipliers: z
      .object({
        LIGHT: z.number().min(0.1).max(10),
        NORMAL: z.number().min(0.1).max(10),
        HEAVY: z.number().min(0.1).max(10),
        EXTREME: z.number().min(0.1).max(10),
      })
      .strict(),
    extraMinutes: z.partialRecord(
      z.enum(
        Object.keys(extrasPrices) as [
          keyof typeof extrasPrices,
          ...Array<keyof typeof extrasPrices>,
        ],
      ),
      z.number().int().min(0).max(1440),
    ),
    notes: z.string().trim().max(1000),
  })
  .strict()
  .refine(
    (v) => v.minArea <= v.maxArea && v.referenceArea <= v.maxArea,
    "Проверьте диапазон площади и базовую площадь",
  );
export const financeSchemas = {
  "expense-create": expenseInput,
  "expense-update": expenseInput.extend({
    id: entityId,
    expectedUpdatedAt: z.iso.datetime(),
  }),
  "expense-delete": z
    .object({ id: entityId, expectedUpdatedAt: z.iso.datetime(), reason })
    .strict(),
  "payout-pay": z
    .object({ id: entityId, expectedUpdatedAt: z.iso.datetime() })
    .strict(),
  "payout-cancel": z
    .object({ id: entityId, expectedUpdatedAt: z.iso.datetime(), reason })
    .strict(),
  "payout-adjust": z
    .object({
      id: entityId,
      expectedUpdatedAt: z.iso.datetime(),
      amount: money,
      reason,
    })
    .strict(),
  "payout-recalculate": z
    .object({ id: entityId, expectedUpdatedAt: z.iso.datetime(), reason })
    .strict(),
  "payout-create-missing": z.object({ orderId: entityId, reason }).strict(),
  "order-price": z
    .object({
      id: entityId,
      expectedUpdatedAt: z.iso.datetime(),
      finalPrice: money,
      reason,
    })
    .strict(),
  settings: z.object({ defaultCleanerPayoutPercent: percent }).strict(),
  "duration-rule": durationRuleInput,
  "duration-active": z.object({ id: entityId, active: z.boolean() }).strict(),
  "duration-estimate": z
    .object({
      service: z.enum(serviceIds),
      area: z.number().min(1).max(10000),
      soilLevel: z.enum(["LIGHT", "NORMAL", "HEAVY", "EXTREME"]),
      requiredCleaners: z.number().int().min(1).max(30),
      extras: extrasSchema,
    })
    .strict(),
  "assignment-time": z
    .object({
      id: entityId,
      orderId: entityId,
      startedAt: z.string().max(30),
      finishedAt: z.string().max(30),
      reason,
    })
    .strict(),
};
export type FinanceCommand = keyof typeof financeSchemas;
