CREATE TABLE "SchedulingProposal" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "date" VARCHAR(10) NOT NULL CHECK ("date" ~ '^\d{4}-\d{2}-\d{2}$'),
  "version" TEXT NOT NULL,
  "plan" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "appliedAt" TIMESTAMPTZ(3)
);
CREATE INDEX "SchedulingProposal_userId_expiresAt_idx" ON "SchedulingProposal"("userId", "expiresAt");
