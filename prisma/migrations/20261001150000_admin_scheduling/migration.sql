BEGIN;
ALTER TABLE "Order" ADD COLUMN "scheduledEnd" TIMESTAMPTZ(3);
ALTER TABLE "OrderCleaner" ADD COLUMN "removedAt" TIMESTAMPTZ(3);
CREATE TABLE "SchedulingOverride" (
  "id" TEXT PRIMARY KEY,
  "orderId" TEXT NOT NULL REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "issueKeys" TEXT[] NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SchedulingOverride_reason_check" CHECK (length(btrim("reason")) BETWEEN 5 AND 1000)
);
CREATE INDEX "SchedulingOverride_orderId_createdAt_idx" ON "SchedulingOverride"("orderId", "createdAt");
CREATE INDEX "Order_scheduledEnd_idx" ON "Order"("scheduledEnd");

-- A null weekly interval explicitly represents a regular day off.
ALTER TABLE "CleanerAvailability" DROP CONSTRAINT "CleanerAvailability_period_check";
ALTER TABLE "CleanerAvailability" ADD CONSTRAINT "CleanerAvailability_period_check" CHECK (
  (("kind" = 'WEEKLY' AND "weekday" BETWEEN 1 AND 7 AND "weekday" IS NOT NULL AND "date" IS NULL)
   OR ("kind" <> 'WEEKLY' AND "date" IS NOT NULL AND "weekday" IS NULL))
  AND (("startMinute" IS NOT NULL AND "endMinute" IS NOT NULL
         AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
       OR ("kind" IN ('WEEKLY','UNAVAILABLE') AND "startMinute" IS NULL AND "endMinute" IS NULL))
);

-- Elapsed minutes are added in UTC. Duration does not change at a DST boundary.
CREATE FUNCTION lumaclean_order_end() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW."scheduledEnd" := CASE
    WHEN NEW."scheduledStart" IS NOT NULL
      AND COALESCE(NEW."manualDurationMinutes", NEW."estimatedDurationMinutes") IS NOT NULL
    THEN ((NEW."scheduledStart" AT TIME ZONE 'UTC')
          + make_interval(mins => COALESCE(NEW."manualDurationMinutes", NEW."estimatedDurationMinutes")))
          AT TIME ZONE 'UTC'
    ELSE NULL END;
  RETURN NEW;
END; $$;
CREATE TRIGGER "Order_derived_end" BEFORE INSERT OR UPDATE ON "Order"
  FOR EACH ROW EXECUTE FUNCTION lumaclean_order_end();
UPDATE "Order" SET "scheduledEnd" = CASE
  WHEN "scheduledStart" IS NOT NULL
    AND COALESCE("manualDurationMinutes", "estimatedDurationMinutes") IS NOT NULL
  THEN (("scheduledStart" AT TIME ZONE 'UTC')
        + make_interval(mins => COALESCE("manualDurationMinutes", "estimatedDurationMinutes")))
        AT TIME ZONE 'UTC'
  ELSE NULL END;
COMMIT;
