-- CreateEnum
CREATE TYPE "SoilLevel" AS ENUM ('LIGHT', 'NORMAL', 'HEAVY', 'EXTREME');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "OrderStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "OrderStatus" ADD VALUE 'EN_ROUTE';
ALTER TYPE "OrderStatus" ADD VALUE 'NO_SHOW';

-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "normalizedPhone" TEXT;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "area" DECIMAL(10,2),
ADD COLUMN     "entrySource" TEXT,
ADD COLUMN     "estimatedPrice" DECIMAL(12,2),
ADD COLUMN     "internalNote" TEXT,
ADD COLUMN     "landingPage" TEXT,
ADD COLUMN     "normalizedPhone" TEXT,
ADD COLUMN     "submissionHash" TEXT,
ADD COLUMN     "submissionId" TEXT,
ADD COLUMN     "telegramStatus" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "discountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "manualDurationMinutes" INTEGER,
ADD COLUMN     "reference" TEXT,
ADD COLUMN     "requestId" TEXT,
ADD COLUMN     "urgent" BOOLEAN NOT NULL DEFAULT false;

-- Preserve existing values. Unknown legacy text aborts instead of silently losing data.
ALTER TABLE "Order" ALTER COLUMN "soilLevel" TYPE "SoilLevel" USING "soilLevel"::"SoilLevel";
ALTER TABLE "Order" ALTER COLUMN "soilLevel" SET DEFAULT 'NORMAL';

UPDATE "Lead" SET "reference" = 'LC-LEGACY-' || "id" WHERE "reference" IS NULL;
UPDATE "Order" SET "reference" = 'ORD-LEGACY-' || "id" WHERE "reference" IS NULL;

-- CreateTable
CREATE TABLE "LeadExtra" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "LeadExtra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeadExtra_leadId_extraId_key" ON "LeadExtra"("leadId", "extraId");

-- CreateIndex
CREATE INDEX "Client_normalizedPhone_idx" ON "Client"("normalizedPhone");

-- CreateIndex
CREATE INDEX "Client_createdAt_idx" ON "Client"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_submissionId_key" ON "Lead"("submissionId");

-- CreateIndex
CREATE INDEX "Lead_createdAt_idx" ON "Lead"("createdAt");

-- CreateIndex
CREATE INDEX "Lead_channel_createdAt_idx" ON "Lead"("channel", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_serviceId_createdAt_idx" ON "Lead"("serviceId", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_normalizedPhone_idx" ON "Lead"("normalizedPhone");

-- CreateIndex
CREATE UNIQUE INDEX "Order_reference_key" ON "Order"("reference");

-- CreateIndex
CREATE UNIQUE INDEX "Order_requestId_key" ON "Order"("requestId");

-- CreateIndex
CREATE INDEX "Order_createdAt_idx" ON "Order"("createdAt");

-- AddForeignKey
ALTER TABLE "LeadExtra" ADD CONSTRAINT "LeadExtra_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadExtra" ADD CONSTRAINT "LeadExtra_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "ServiceExtra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lead" ADD CONSTRAINT "Lead_crm_values_check" CHECK (
  ("area" IS NULL OR "area" > 0) AND ("estimatedPrice" IS NULL OR "estimatedPrice" >= 0)
  AND (("submissionId" IS NULL) = ("submissionHash" IS NULL))
);
ALTER TABLE "LeadExtra" ADD CONSTRAINT "LeadExtra_values_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_crm_values_check" CHECK (
  "discountPercent" BETWEEN 0 AND 100 AND ("manualDurationMinutes" IS NULL OR "manualDurationMinutes" > 0)
);
