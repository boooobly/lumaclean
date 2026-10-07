-- Preserve existing records and live-order requirements while representing missing historical facts.
ALTER TABLE "Client" ALTER COLUMN "phone" DROP NOT NULL;
ALTER TABLE "Client" ADD COLUMN "legacyImportKey" TEXT;
CREATE UNIQUE INDEX "Client_legacyImportKey_key" ON "Client"("legacyImportKey");
ALTER TABLE "ClientAddress" ADD COLUMN "coordinatesSource" TEXT;
ALTER TABLE "Order" ALTER COLUMN "serviceId" DROP NOT NULL;
ALTER TABLE "Order" ADD COLUMN "historicalServiceDate" DATE, ADD COLUMN "historicalServiceLabel" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_live_service_check" CHECK (historical OR "serviceId" IS NOT NULL);
ALTER TABLE "Order" DROP CONSTRAINT "Order_completion_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_completion_check" CHECK (
 "status" <> 'COMPLETED' OR ("finalPrice" IS NOT NULL AND
 ((historical AND ("historicalServiceDate" IS NOT NULL OR "completedAt" IS NOT NULL)) OR
 (NOT historical AND "completedAt" IS NOT NULL)))
);
ALTER TABLE "Expense" ADD COLUMN "legacyFinance" JSONB;
ALTER TABLE "CleanerPayout" ALTER COLUMN "cleanerId" DROP NOT NULL,
 ALTER COLUMN "appliedPercent" DROP NOT NULL, ALTER COLUMN "basisAmount" DROP NOT NULL,
 ADD COLUMN "historical" BOOLEAN NOT NULL DEFAULT false,
 ADD COLUMN "recipientName" TEXT, ADD COLUMN "sourceKey" TEXT, ADD COLUMN "legacyFinance" JSONB;
CREATE UNIQUE INDEX "CleanerPayout_sourceKey_key" ON "CleanerPayout"("sourceKey");
ALTER TABLE "CleanerPayout" DROP CONSTRAINT "CleanerPayout_values_check";
ALTER TABLE "CleanerPayout" ADD CONSTRAINT "CleanerPayout_values_check" CHECK (
 "amount" >= 0 AND (
 (historical AND "recipientName" IS NOT NULL AND "sourceKey" IS NOT NULL AND "status"='PAID') OR
 (NOT historical AND "cleanerId" IS NOT NULL AND "appliedPercent" IS NOT NULL AND
  "basisAmount" IS NOT NULL AND "appliedPercent" BETWEEN 0 AND 100 AND "basisAmount">=0 AND
  ("status"<>'PAID' OR "paidAt" IS NOT NULL))
 ));
