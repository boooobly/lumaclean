-- Additive transport metadata; existing Orders and Website receipts are unchanged.
ALTER TABLE "Message" ADD COLUMN "inboundKey" TEXT,
ADD COLUMN "receivedAt" TIMESTAMPTZ(3),
ADD COLUMN "nextDeliveryAttemptAt" TIMESTAMPTZ(3),
ADD COLUMN "sendingStartedAt" TIMESTAMPTZ(3),
ADD COLUMN "deliveryUpdatedAt" TIMESTAMPTZ(3),
ADD COLUMN "providerSentAt" TIMESTAMPTZ(3),
ADD COLUMN "deliveredAt" TIMESTAMPTZ(3);
CREATE UNIQUE INDEX "Message_inboundKey_key" ON "Message"("inboundKey");
CREATE INDEX "Message_deliveryStatus_nextDeliveryAttemptAt_idx" ON "Message"("deliveryStatus", "nextDeliveryAttemptAt");
ALTER TABLE "BusinessSettings" ADD COLUMN "customerChannelDiagnostics" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN "customerNotificationChannels" JSONB NOT NULL DEFAULT '{"TELEGRAM":false,"WHATSAPP":false,"VIBER":false}';
