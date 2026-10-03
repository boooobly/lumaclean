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
      placeId: z.string().min(1).max(300),
      sessionToken: z.uuid(),
      query: z.string().trim().min(3).max(200).optional(),
    })
    .strict(),
  "reverse-geocode": z
    .object({
      latitude: z.number().min(44.2).max(45.2),
      longitude: z.number().min(19.9).max(21),
    })
    .strict(),
  "confirm-location": z
    .object({
      address: z.string().trim().min(5).max(500),
      latitude: z.number().min(44.2).max(45.2),
      longitude: z.number().min(19.9).max(21),
      userConfirmed: z.literal(true),
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
