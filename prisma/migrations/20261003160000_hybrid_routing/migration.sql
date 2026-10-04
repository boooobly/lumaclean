ALTER TABLE "BusinessSettings" ADD COLUMN "fallbackTravelMinutes" INTEGER NOT NULL DEFAULT 80;
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "fallback_travel_bounds" CHECK ("fallbackTravelMinutes" BETWEEN 5 AND 240);
CREATE TABLE "RoutingUsageMonth" (
  "period" TEXT PRIMARY KEY,
  "requests" INTEGER NOT NULL DEFAULT 0,
  "cacheHits" INTEGER NOT NULL DEFAULT 0,
  "errors" INTEGER NOT NULL DEFAULT 0,
  "liveLegs" INTEGER NOT NULL DEFAULT 0,
  "fallbackLegs" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "RoutingRequestLease" (
  "key" TEXT PRIMARY KEY, "owner" TEXT NOT NULL, "expiresAt" TIMESTAMPTZ(3) NOT NULL
);
CREATE TABLE "RoutingBenchmark" (
  "id" TEXT PRIMARY KEY, "request" JSONB NOT NULL, "motis" JSONB,
  "busmaps" JSONB, "checkedAt" TIMESTAMPTZ(3), "googleMinutes" INTEGER,
  "referenceAt" TIMESTAMPTZ(3), "referenceDate" TIMESTAMPTZ(3), "updatedBy" TEXT,
  CONSTRAINT "benchmark_reference_bounds" CHECK ("googleMinutes" IS NULL OR "googleMinutes" BETWEEN 1 AND 240)
);
