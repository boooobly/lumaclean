-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExpenseCategory" ADD VALUE 'MARKETING';
ALTER TYPE "ExpenseCategory" ADD VALUE 'SOFTWARE';
BEGIN;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "durationOverrideReason" TEXT,
ADD COLUMN     "durationRuleVersion" INTEGER,
ADD COLUMN     "durationSnapshot" JSONB,
ADD COLUMN     "historical" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "legacyFinance" JSONB,
ADD COLUMN     "legacyId" TEXT;

-- AlterTable
ALTER TABLE "DurationRule" ADD COLUMN     "extraMinutes" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "referenceArea" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reserveMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "soilMultipliers" JSONB NOT NULL DEFAULT '{"LIGHT":1,"NORMAL":1,"HEAVY":1,"EXTREME":1}';

-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "deletedAt" TIMESTAMPTZ(3),
ADD COLUMN     "deletionReason" TEXT;

-- AlterTable
ALTER TABLE "CleanerPayout" ADD COLUMN     "adjustmentReason" TEXT;

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "preview" JSONB NOT NULL,
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "appliedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRecord" (
    "sourceKey" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportRecord_pkey" PRIMARY KEY ("sourceKey")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "paidBy" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "returnedAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RSD',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ImportBatch_userId_fileHash_key" ON "ImportBatch"("userId", "fileHash");

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRecord" ADD CONSTRAINT "ImportRecord_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve existing schedule restrictions; historical rows never fabricate a start time.
ALTER TABLE "Order" DROP CONSTRAINT "Order_schedule_check";
ALTER TABLE "Order" ADD CONSTRAINT "Order_schedule_check" CHECK (
  ("historical" AND "status" IN ('COMPLETED','CANCELLED','DRAFT') AND "scheduledStart" IS NULL AND "windowFrom" IS NULL AND "windowTo" IS NULL)
  OR ("scheduleMode" = 'FIXED' AND "windowFrom" IS NULL AND "windowTo" IS NULL AND ("status" IN ('DRAFT','CANCELLED') OR "scheduledStart" IS NOT NULL))
  OR ("scheduleMode" = 'FLEXIBLE' AND "windowFrom" IS NOT NULL AND "windowTo" IS NOT NULL AND "windowFrom" < "windowTo" AND ("scheduledStart" IS NULL OR "scheduledStart" >= "windowFrom" AND "scheduledStart" < "windowTo"))
);
ALTER TABLE "DurationRule" DROP CONSTRAINT "DurationRule_values_check";
ALTER TABLE "DurationRule" ADD CONSTRAINT "DurationRule_values_check" CHECK (
  "version" > 0 AND "cleanerCount" > 0 AND ("minArea" IS NULL OR "minArea" >= 0)
  AND ("maxArea" IS NULL OR "maxArea" >= COALESCE("minArea",0))
  AND ("baseMinutes" IS NULL OR "baseMinutes" > 0)
  AND ("minutesPerSquare" IS NULL OR "minutesPerSquare" >= 0)
  AND "referenceArea" >= 0 AND "reserveMinutes" BETWEEN 0 AND 240
);
CREATE FUNCTION lumaclean_duration_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (to_jsonb(NEW) - 'active') IS DISTINCT FROM (to_jsonb(OLD) - 'active') THEN
    RAISE EXCEPTION 'Duration parameters are immutable; create a new version';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER "DurationRule_immutable" BEFORE UPDATE ON "DurationRule" FOR EACH ROW EXECUTE FUNCTION lumaclean_duration_immutable();
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_values_check" CHECK ("amount" >= 0 AND "returnedAmount" BETWEEN 0 AND "amount");
CREATE INDEX "ImportBatch_userId_createdAt_idx" ON "ImportBatch"("userId","createdAt");
COMMIT;
