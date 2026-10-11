import { z } from "zod";
import { calculatePrice, serviceIds, urgentSurcharge } from "./pricing";
export const upholsteryPriceKeys = [
  "sofa3Light",
  "sofa3Normal",
  "sofa3Heavy",
  "sofa2",
  "armchair",
  "chair",
  "cornerSeat",
  "spot",
  "minimumVisit",
] as const;
export const upholsteryDefaults = {
  sofa3Light: 2500,
  sofa3Normal: 3000,
  sofa3Heavy: 3800,
  sofa2: 2400,
  armchair: 1200,
  chair: 500,
  cornerSeat: 900,
  spot: 1500,
  minimumVisit: 3000,
};
export const upholsteryCatalogSchema = z
  .object(
    Object.fromEntries(
      upholsteryPriceKeys.map((k) => [k, z.number().int().min(1).max(100000)]),
    ) as Record<(typeof upholsteryPriceKeys)[number], z.ZodNumber>,
  )
  .strict();
export type UpholsteryCatalog = z.infer<typeof upholsteryCatalogSchema>;
export const furnitureTypes = [
  "SOFA3",
  "SOFA2",
  "ARMCHAIR",
  "CHAIR",
  "CORNER",
  "SPOT",
] as const;
export const furnitureSchema = z
  .object({
    objectRef: z.string().trim().max(100).optional(),
    type: z.enum(furnitureTypes),
    quantity: z.number().int().min(1).max(30),
    seats: z.number().int().min(2).max(20).optional(),
    size: z.string().trim().max(100).default("standard"),
    soil: z.enum(["LIGHT", "NORMAL", "HEAVY"]),
    fabric: z.enum(["WET_COMPATIBLE", "UNKNOWN", "UNSAFE"]),
    material: z.string().trim().max(160).default(""),
    notes: z.string().trim().max(500).default(""),
  })
  .strict()
  .superRefine((v, c) => {
    if (v.type === "CORNER" && !v.seats)
      c.addIssue({
        code: "custom",
        path: ["seats"],
        message: "Укажите посадочные места",
      });
  });
export const upholsteryRequestSchema = z
  .object({
    mode: z.enum(["STANDALONE", "ADDON"]),
    items: z.array(furnitureSchema).min(1).max(20),
    urgent: z.boolean(),
    cleaning: z
      .object({
        service: z.enum(serviceIds),
        area: z.number().finite().min(1).max(1000),
      })
      .strict()
      .optional(),
  })
  .strict()
  .superRefine((v, c) => {
    const mixed =
      v.items.some((i) => i.type === "SPOT") &&
      v.items.some((i) => i.type !== "SPOT");
    if (
      mixed &&
      (v.items.some((i) => !i.objectRef) ||
        v.items.some(
          (i) =>
            i.type === "SPOT" &&
            v.items.some(
              (other) =>
                other.type !== "SPOT" && other.objectRef === i.objectRef,
            ),
        ))
    )
      c.addIssue({
        code: "custom",
        path: ["items"],
        message:
          "Укажите разные предметы для локального пятна и полной чистки. Одну работу нельзя считать дважды.",
      });
    if (v.mode === "STANDALONE" && v.cleaning)
      c.addIssue({
        code: "custom",
        path: ["cleaning"],
        message: "Standalone has no area cleaning",
      });
  });
export type UpholsteryRequest = z.infer<typeof upholsteryRequestSchema>;
export function calculateUpholstery(
  input: UpholsteryRequest,
  catalog: UpholsteryCatalog,
  version: number,
) {
  const v = upholsteryRequestSchema.parse(input),
    p = upholsteryCatalogSchema.parse(catalog);
  const lines = v.items.map((item, index) => {
    const key =
      item.type === "SOFA3"
        ? (
            {
              LIGHT: "sofa3Light",
              NORMAL: "sofa3Normal",
              HEAVY: "sofa3Heavy",
            } as const
          )[item.soil]
        : (
            {
              SOFA2: "sofa2",
              ARMCHAIR: "armchair",
              CHAIR: "chair",
              CORNER: "cornerSeat",
              SPOT: "spot",
            } as const
          )[item.type];
    const units = item.quantity * (item.type === "CORNER" ? item.seats! : 1);
    return {
      index,
      type: item.type,
      soil: item.soil,
      quantity: item.quantity,
      units,
      unitPrice: p[key],
      amount: p[key] * units,
      from: item.soil === "HEAVY" || item.type === "SPOT",
    };
  });
  const itemsSubtotal = lines.reduce((s, l) => s + l.amount, 0),
    minimumAdjustment =
      v.mode === "STANDALONE" ? Math.max(0, p.minimumVisit - itemsSubtotal) : 0;
  const cleaningBase = v.cleaning
    ? calculatePrice(v.cleaning.service, v.cleaning.area, [], false).total
    : 0;
  const subtotal = cleaningBase + itemsSubtotal + minimumAdjustment,
    surcharge = urgentSurcharge(subtotal, v.urgent);
  const reviewReasons = [
    ...new Set(
      v.items.flatMap((i) => [
        ...(i.fabric === "UNKNOWN" ? ["MATERIAL_UNKNOWN"] : []),
        ...(i.fabric === "UNSAFE" ? ["MATERIAL_UNSAFE"] : []),
        ...(i.soil === "HEAVY" ? ["PHOTO_PRICE_REVIEW"] : []),
        ...(i.type === "SPOT" ? ["STAIN_REVIEW"] : []),
        ...(i.size !== "standard" ? ["SIZE_REVIEW"] : []),
      ]),
    ),
  ];
  return {
    version,
    mode: v.mode,
    lines,
    itemsSubtotal,
    minimumAdjustment,
    cleaningBase,
    subtotal,
    surcharge,
    total: subtotal + surcharge,
    currency: "RSD" as const,
    deliveryIncluded: true,
    from: lines.some((l) => l.from),
    reviewReasons,
    materialRejected: v.items.some((i) => i.fabric === "UNSAFE"),
    bookingRequiresHumanReview: true as const,
    autonomousBooking: false as const,
  };
}
export function extractorIntervalsConflict(
  a: { start: Date; end: Date; transferMinutes: number },
  b: { start: Date; end: Date; transferMinutes: number },
) {
  const buffer = Math.max(a.transferMinutes, b.transferMinutes) * 60000;
  return (
    a.start.getTime() < b.end.getTime() + buffer &&
    b.start.getTime() < a.end.getTime() + buffer
  );
}
