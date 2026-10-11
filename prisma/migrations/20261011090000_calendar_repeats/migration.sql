CREATE TABLE "OrderRepeatSeries" (
 "id" TEXT PRIMARY KEY, "requestId" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
 "sourceOrderId" TEXT NOT NULL, "template" JSONB NOT NULL, "weekly" BOOLEAN NOT NULL DEFAULT false,
 "weekdays" INTEGER[] NOT NULL, "endsOn" DATE NOT NULL, "stoppedAt" TIMESTAMPTZ(3),
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ(3) NOT NULL,
 CONSTRAINT "OrderRepeatSeries_sourceOrderId_fkey" FOREIGN KEY ("sourceOrderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OrderRepeatSeries_requestId_key" ON "OrderRepeatSeries"("requestId");
ALTER TABLE "Order" ADD COLUMN "copiedFromId" TEXT, ADD COLUMN "repeatSeriesId" TEXT;
ALTER TABLE "Order" ADD CONSTRAINT "Order_copiedFromId_fkey" FOREIGN KEY ("copiedFromId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_repeatSeriesId_fkey" FOREIGN KEY ("repeatSeriesId") REFERENCES "OrderRepeatSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Order_copiedFromId_scheduledStart_idx" ON "Order"("copiedFromId", "scheduledStart");
CREATE INDEX "Order_repeatSeriesId_scheduledStart_idx" ON "Order"("repeatSeriesId", "scheduledStart");
