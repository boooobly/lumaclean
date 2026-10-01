-- CreateEnum
CREATE TYPE "AgentMode" AS ENUM ('OFF', 'SHADOW', 'AUTO');

-- CreateEnum
CREATE TYPE "ConversationControl" AS ENUM ('AI_CONTROL', 'HUMAN_CONTROL', 'CLOSED');

-- CreateEnum
CREATE TYPE "ConversationStage" AS ENUM ('DISCOVERY', 'QUALIFYING', 'QUOTING', 'SCHEDULING', 'AWAITING_CONFIRMATION', 'BOOKED', 'HANDOFF', 'CLOSED');

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "anonymousHash" TEXT,
ADD COLUMN     "control" "ConversationControl" NOT NULL DEFAULT 'AI_CONTROL',
ADD COLUMN     "identityVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastMessageAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "locale" TEXT NOT NULL DEFAULT 'ru',
ADD COLUMN     "needsAttention" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerId" TEXT,
ADD COLUMN     "revision" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sessionExpiresAt" TIMESTAMPTZ(3),
ADD COLUMN     "shadowProposal" JSONB,
ADD COLUMN     "stage" "ConversationStage" NOT NULL DEFAULT 'DISCOVERY',
ADD COLUMN     "state" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "unreadCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "deliveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryError" TEXT,
ADD COLUMN     "deliveryStatus" TEXT NOT NULL DEFAULT 'DELIVERED',
ADD COLUMN     "structured" JSONB;

-- AlterTable
ALTER TABLE "BusinessSettings" ADD COLUMN     "aiAgentMode" "AgentMode" NOT NULL DEFAULT 'SHADOW';

-- CreateTable
CREATE TABLE "AgentJob" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "leaseUntil" TIMESTAMPTZ(3),
    "leaseKey" TEXT,
    "errorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ(3),

    CONSTRAINT "AgentJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIInvocation" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "estimatedCostUsd" DECIMAL(12,8),
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL,
    "errorCode" TEXT,
    "mode" "AgentMode" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentToolTrace" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "tool" TEXT NOT NULL,
    "outcome" TEXT NOT NULL,
    "entityId" TEXT,
    "latencyMs" INTEGER NOT NULL,
    "shadow" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentToolTrace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentSlot" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "scheduleVersion" TEXT NOT NULL,
    "start" TIMESTAMPTZ(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "requiredCleaners" INTEGER NOT NULL,
    "cleanerIds" TEXT[],
    "routingSnapshot" JSONB NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt" TIMESTAMPTZ(3),
    "result" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentJob_messageId_key" ON "AgentJob"("messageId");

-- CreateIndex
CREATE INDEX "AgentJob_status_leaseUntil_createdAt_idx" ON "AgentJob"("status", "leaseUntil", "createdAt");

-- CreateIndex
CREATE INDEX "AgentJob_conversationId_createdAt_idx" ON "AgentJob"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AIInvocation_createdAt_provider_model_idx" ON "AIInvocation"("createdAt", "provider", "model");

-- CreateIndex
CREATE INDEX "AIInvocation_conversationId_createdAt_idx" ON "AIInvocation"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentToolTrace_conversationId_createdAt_idx" ON "AgentToolTrace"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentToolTrace_createdAt_outcome_idx" ON "AgentToolTrace"("createdAt", "outcome");

-- CreateIndex
CREATE INDEX "AgentSlot_conversationId_expiresAt_idx" ON "AgentSlot"("conversationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_anonymousHash_key" ON "Conversation"("anonymousHash");

-- CreateIndex
CREATE INDEX "Conversation_control_lastMessageAt_idx" ON "Conversation"("control", "lastMessageAt");

-- CreateIndex
CREATE INDEX "Conversation_needsAttention_lastMessageAt_idx" ON "Conversation"("needsAttention", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "AgentJob" ADD CONSTRAINT "AgentJob_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIInvocation" ADD CONSTRAINT "AIInvocation_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentToolTrace" ADD CONSTRAINT "AgentToolTrace_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentSlot" ADD CONSTRAINT "AgentSlot_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Conversation" ADD COLUMN "shadowState" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Message" ADD COLUMN "channelMessageId" TEXT;
