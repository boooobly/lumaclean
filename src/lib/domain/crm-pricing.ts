import { calculatePrice, extrasPrices, type ServiceId } from "@/lib/pricing";
import { CrmError } from "./crm-types";
export const quantityExtras = [
  "standardWindow",
  "largeWindow",
  "cabinets",
  "ironing",
] as const;
export type ExtraCode = keyof typeof extrasPrices;
export type ExtraQuantity = { code: ExtraCode; quantity: number };
export function quote(
  service: ServiceId,
  area: number,
  extras: ExtraQuantity[],
  urgent: boolean,
) {
  return calculatePrice(service, area, extras, urgent);
}
export function priceSnapshot(
  calculated: number,
  discountPercent: number,
  final: number | null,
  reason: string | null,
) {
  const discountAmount = Math.round(calculated * discountPercent) / 100;
  const suggested = Math.round((calculated - discountAmount) * 100) / 100;
  const finalPrice = final ?? suggested;
  const adjustment = Math.round((finalPrice - suggested) * 100) / 100;
  if (adjustment !== 0 && !reason?.trim())
    throw new CrmError(
      "VALIDATION",
      "Объясните изменение цены.",
      "priceChangeReason",
    );
  return {
    basePrice: calculated,
    discountPercent,
    discountAmount,
    finalPrice,
    priceAdjustment: adjustment,
    priceChangeReason: adjustment ? reason : null,
  };
}
