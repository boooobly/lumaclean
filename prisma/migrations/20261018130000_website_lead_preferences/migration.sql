-- Additive intake preferences only. No Order, finance or snapshot backfill.
ALTER TABLE "Lead"
  ALTER COLUMN "name" DROP NOT NULL,
  ADD COLUMN "preferredDate" DATE,
  ADD COLUMN "preferredTime" TEXT,
  ADD COLUMN "preferredChannel" "Channel",
  ADD COLUMN "soilLevel" "SoilLevel";
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_preferredTime_check"
  CHECK ("preferredTime" IS NULL OR "preferredTime" IN ('MORNING', 'AFTERNOON', 'EVENING'));
