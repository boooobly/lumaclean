-- AlterTable
ALTER TABLE "DurationRule" ADD COLUMN     "unknownExtraReserveMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "audience" TEXT,
ADD COLUMN     "conversationId" TEXT,
ADD COLUMN     "deliveryState" TEXT NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "eventKey" TEXT,
ADD COLUMN     "kind" TEXT,
ADD COLUMN     "leaseKey" TEXT,
ADD COLUMN     "leaseUntil" TIMESTAMPTZ(3),
ADD COLUMN     "nextAttemptAt" TIMESTAMPTZ(3),
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "payload" JSONB,
ADD COLUMN     "publishedAt" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "aiAllowedServices" TEXT[] DEFAULT ARRAY['regular', 'deep']::TEXT[],
ADD COLUMN     "aiCanary" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "aiChannelModes" JSONB NOT NULL DEFAULT '{"WEBSITE":"AUTO","TELEGRAM":"OFF","WHATSAPP":"OFF","VIBER":"OFF"}',
ADD COLUMN     "aiDailyCostWarningUsd" DECIMAL(10,2) NOT NULL DEFAULT 5,
ADD COLUMN     "aiDiagnostics" JSONB,
ADD COLUMN     "aiDiagnosticsAt" TIMESTAMPTZ(3),
ADD COLUMN     "aiMaxAnonymousMessages" INTEGER NOT NULL DEFAULT 200,
ADD COLUMN     "aiMaxConversationCostUsd" DECIMAL(10,5) NOT NULL DEFAULT 0.1,
ADD COLUMN     "aiMaxModelCalls" INTEGER NOT NULL DEFAULT 8,
ADD COLUMN     "aiMaxToolSteps" INTEGER NOT NULL DEFAULT 6;

-- CreateTable
CREATE TABLE "ShadowSuggestion" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "verdict" TEXT,
    "reason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShadowSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ShadowSuggestion_jobId_key" ON "ShadowSuggestion"("jobId");

-- CreateIndex
CREATE INDEX "ShadowSuggestion_conversationId_createdAt_idx" ON "ShadowSuggestion"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "ShadowSuggestion_reviewedAt_verdict_idx" ON "ShadowSuggestion"("reviewedAt", "verdict");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_eventKey_key" ON "Notification"("eventKey");

-- CreateIndex
CREATE INDEX "Notification_deliveryState_scheduledAt_idx" ON "Notification"("deliveryState", "scheduledAt");

-- CreateIndex
CREATE INDEX "Notification_orderId_idx" ON "Notification"("orderId");

-- Preserve existing SHADOW drafts as reviewable snapshots; never infer a verdict.
INSERT INTO "ShadowSuggestion" (id,"conversationId","jobId",snapshot)
SELECT 'legacy-shadow-' || id, id, 'legacy-shadow-' || id, "shadowProposal"
FROM "Conversation" WHERE "shadowProposal" IS NOT NULL AND "shadowProposal" <> 'null'::jsonb;

ALTER TABLE "BusinessSettings" ADD CONSTRAINT "AI_limits_valid" CHECK (
 "aiMaxAnonymousMessages" BETWEEN 10 AND 1000 AND "aiMaxModelCalls" BETWEEN 1 AND 16
 AND "aiMaxToolSteps" BETWEEN 1 AND 8 AND "aiMaxConversationCostUsd" BETWEEN 0.01 AND 10
 AND "aiDailyCostWarningUsd" BETWEEN 0.1 AND 100);
ALTER TABLE "DurationRule" ADD CONSTRAINT "Duration_unknown_reserve_valid" CHECK ("unknownExtraReserveMinutes" BETWEEN 0 AND 240);
