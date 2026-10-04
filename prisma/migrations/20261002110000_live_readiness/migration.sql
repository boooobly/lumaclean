ALTER TABLE "BusinessSettings" ADD COLUMN "aiLiveTestProof" JSONB;
CREATE TABLE "AgentLiveTest" (
  "id" TEXT NOT NULL,
  "conversationId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RUNNING',
  "report" JSONB NOT NULL DEFAULT '{}',
  "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMPTZ(3),
  CONSTRAINT "AgentLiveTest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AgentLiveTest_conversationId_key" ON "AgentLiveTest"("conversationId");
