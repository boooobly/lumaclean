-- Existing orders keep AREA and all financial/duration values.
ALTER TABLE "Order" ADD COLUMN "pricingBasis" TEXT NOT NULL DEFAULT 'AREA';
ALTER TABLE "Order" DROP CONSTRAINT "Order_amounts_duration_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_duration_check" CHECK (
  (("pricingBasis"='AREA' AND "area">0) OR ("pricingBasis"='ITEMS' AND "area"=0))
  AND "requiredCleaners">0 AND "cleaningReserveMinutes">=0 AND "travelBufferMinutes">=0
  AND ("estimatedDurationMinutes" IS NULL OR "estimatedDurationMinutes">0)
  AND ("actualDurationMinutes" IS NULL OR "actualDurationMinutes">0)
  AND ("basePrice" IS NULL OR "basePrice">=0) AND ("finalPrice" IS NULL OR "finalPrice">=0) AND "discountAmount">=0
  AND (COALESCE("priceAdjustment",0)=0 OR ("priceChangeReason" IS NOT NULL AND length(trim("priceChangeReason"))>0))
);
