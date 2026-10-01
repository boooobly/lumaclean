import { z } from "zod";
import { dateOnly } from "./scheduling";
import { entityId } from "./crm";
export const routingSchemas = {
  autocomplete: z
    .object({
      query: z.string().trim().min(3).max(200),
      sessionToken: z.uuid(),
    })
    .strict(),
  place: z
    .object({
      placeId: z
        .string()
        .min(1)
        .max(300)
        .regex(/^[A-Za-z0-9_-]+$/),
      sessionToken: z.uuid(),
    })
    .strict(),
  day: z.object({ date: dateOnly, cleanerId: entityId.optional() }).strict(),
  slots: z
    .object({
      date: dateOnly,
      orderId: entityId.optional(),
      addressId: entityId.optional(),
      locationProof: z.string().max(2000).optional(),
      duration: z.number().int().min(1).max(1440),
      requiredCleaners: z.number().int().min(1).max(20),
      from: z.string().max(30),
      to: z.string().max(30),
    })
    .strict(),
  optimize: z.object({ date: dateOnly }).strict(),
  apply: z.object({ proposalId: entityId }).strict(),
  details: z
    .object({
      date: dateOnly,
      orderId: entityId,
      cleanerId: entityId,
      taxi: z.boolean().default(false),
    })
    .strict(),
};
export type RoutingCommand = keyof typeof routingSchemas;
