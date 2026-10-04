-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CLEANER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'WAITING_CLIENT', 'READY_TO_BOOK', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "Channel" AS ENUM ('WEBSITE', 'TELEGRAM', 'WHATSAPP', 'VIBER', 'MANUAL', 'OTHER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ScheduleMode" AS ENUM ('FIXED', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('WEEKLY', 'AVAILABLE', 'UNAVAILABLE');

-- CreateEnum
CREATE TYPE "TravelMode" AS ENUM ('PUBLIC_TRANSIT', 'WALKING', 'CAR', 'TAXI');

-- CreateEnum
CREATE TYPE "MessageAuthor" AS ENUM ('CLIENT', 'ADMIN', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'AI', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TRANSPORT', 'TAXI', 'CHEMICALS', 'EQUIPMENT', 'PAYOUT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CLEANER',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(3),
    "refreshTokenExpiresAt" TIMESTAMPTZ(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cleaner" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "additionalContact" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "homeAddress" TEXT,
    "homeLatitude" DECIMAL(10,7),
    "homeLongitude" DECIMAL(10,7),
    "homePlaceId" TEXT,
    "languages" TEXT[],
    "skills" TEXT[],
    "internalRating" DECIMAL(3,2),
    "notes" TEXT,
    "payoutPercent" DECIMAL(5,2),
    "defaultTravelMode" "TravelMode" NOT NULL DEFAULT 'PUBLIC_TRANSIT',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Cleaner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanerAvailability" (
    "id" TEXT NOT NULL,
    "cleanerId" TEXT NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,
    "weekday" INTEGER,
    "date" DATE,
    "startMinute" INTEGER,
    "endMinute" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CleanerAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegram" TEXT,
    "whatsapp" TEXT,
    "viber" TEXT,
    "preferredChannel" "Channel",
    "notes" TEXT,
    "discountPercent" DECIMAL(5,2),
    "individualTerms" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientAddress" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "label" TEXT,
    "fullAddress" TEXT NOT NULL,
    "comment" TEXT,
    "apartment" TEXT,
    "floor" TEXT,
    "intercom" TEXT,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "placeId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ClientAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "reference" TEXT,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "locale" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "channel" "Channel" NOT NULL DEFAULT 'WEBSITE',
    "lostReason" TEXT,
    "serviceId" TEXT,
    "comment" TEXT,
    "estimateText" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Service" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Service_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicePriceBand" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "minArea" DECIMAL(10,2) NOT NULL,
    "maxArea" DECIMAL(10,2),
    "fixedPrice" DECIMAL(12,2),
    "pricePerSquare" DECIMAL(12,2),
    "validFrom" TIMESTAMPTZ(3) NOT NULL,
    "validUntil" TIMESTAMPTZ(3),

    CONSTRAINT "ServicePriceBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceExtra" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ServiceExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "leadId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'DRAFT',
    "serviceId" TEXT NOT NULL,
    "area" DECIMAL(10,2) NOT NULL,
    "soilLevel" TEXT,
    "scheduleMode" "ScheduleMode" NOT NULL DEFAULT 'FIXED',
    "scheduledStart" TIMESTAMPTZ(3),
    "windowFrom" TIMESTAMPTZ(3),
    "windowTo" TIMESTAMPTZ(3),
    "estimatedDurationMinutes" INTEGER,
    "actualDurationMinutes" INTEGER,
    "cleaningReserveMinutes" INTEGER NOT NULL DEFAULT 0,
    "travelBufferMinutes" INTEGER NOT NULL,
    "durationRuleId" TEXT,
    "basePrice" DECIMAL(12,2),
    "finalPrice" DECIMAL(12,2),
    "priceAdjustment" DECIMAL(12,2),
    "priceChangeReason" TEXT,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RSD',
    "clientComment" TEXT,
    "internalComment" TEXT,
    "requiredCleaners" INTEGER NOT NULL DEFAULT 1,
    "source" "Channel" NOT NULL DEFAULT 'MANUAL',
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderCleaner" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "cleanerId" TEXT NOT NULL,
    "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(3),
    "startedAt" TIMESTAMPTZ(3),
    "finishedAt" TIMESTAMPTZ(3),
    "notes" TEXT,

    CONSTRAINT "OrderCleaner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderExtra" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "extraId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "durationMinutes" INTEGER,

    CONSTRAINT "OrderExtra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DurationRule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "minArea" DECIMAL(10,2),
    "maxArea" DECIMAL(10,2),
    "cleanerCount" INTEGER NOT NULL,
    "soilLevel" TEXT,
    "baseMinutes" INTEGER,
    "minutesPerSquare" DECIMAL(10,4),
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DurationRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteCalculation" (
    "id" TEXT NOT NULL,
    "cacheKey" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "originLatitude" DECIMAL(10,7),
    "originLongitude" DECIMAL(10,7),
    "destination" TEXT NOT NULL,
    "destinationLatitude" DECIMAL(10,7),
    "destinationLongitude" DECIMAL(10,7),
    "travelMode" "TravelMode" NOT NULL DEFAULT 'PUBLIC_TRANSIT',
    "departureAt" TIMESTAMPTZ(3),
    "durationSeconds" INTEGER NOT NULL,
    "distanceMeters" INTEGER NOT NULL,
    "provider" TEXT NOT NULL,
    "calculatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RouteCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL,
    "channel" "Channel" NOT NULL,
    "externalThreadId" TEXT,
    "clientId" TEXT,
    "leadId" TEXT,
    "orderId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "author" "MessageAuthor" NOT NULL,
    "userId" TEXT,
    "text" TEXT NOT NULL,
    "sentAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "externalMessageId" TEXT,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HumanHandoff" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(3),
    "resolvedById" TEXT,
    "resolution" TEXT,

    CONSTRAINT "HumanHandoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RSD',
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "orderId" TEXT,
    "payoutId" TEXT,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CleanerPayout" (
    "id" TEXT NOT NULL,
    "cleanerId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "appliedPercent" DECIMAL(5,2) NOT NULL,
    "basisAmount" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RSD',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CleanerPayout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "cleanerId" TEXT,
    "userId" TEXT,
    "channel" "Channel" NOT NULL,
    "text" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMPTZ(3) NOT NULL,
    "sentAt" TIMESTAMPTZ(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "userId" TEXT,
    "actorKey" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "changes" JSONB,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Belgrade',
    "currency" VARCHAR(3) NOT NULL DEFAULT 'RSD',
    "defaultTravelBufferMinutes" INTEGER NOT NULL DEFAULT 30,
    "defaultCleanerPayoutPercent" DECIMAL(5,2),
    "workdayStartMinute" INTEGER,
    "workdayEndMinute" INTEGER,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "BusinessSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_providerId_accountId_key" ON "Account"("providerId", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- CreateIndex
CREATE UNIQUE INDEX "Cleaner_userId_key" ON "Cleaner"("userId");

-- CreateIndex
CREATE INDEX "Cleaner_active_idx" ON "Cleaner"("active");

-- CreateIndex
CREATE INDEX "CleanerAvailability_cleanerId_weekday_idx" ON "CleanerAvailability"("cleanerId", "weekday");

-- CreateIndex
CREATE INDEX "CleanerAvailability_cleanerId_date_idx" ON "CleanerAvailability"("cleanerId", "date");

-- CreateIndex
CREATE INDEX "Client_phone_idx" ON "Client"("phone");

-- CreateIndex
CREATE INDEX "ClientAddress_clientId_active_idx" ON "ClientAddress"("clientId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "ClientAddress_id_clientId_key" ON "ClientAddress"("id", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_reference_key" ON "Lead"("reference");

-- CreateIndex
CREATE INDEX "Lead_status_createdAt_idx" ON "Lead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Lead_clientId_idx" ON "Lead"("clientId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_code_key" ON "Service"("code");

-- CreateIndex
CREATE INDEX "ServicePriceBand_serviceId_validFrom_idx" ON "ServicePriceBand"("serviceId", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceExtra_code_key" ON "ServiceExtra"("code");

-- CreateIndex
CREATE INDEX "Order_status_scheduledStart_idx" ON "Order"("status", "scheduledStart");

-- CreateIndex
CREATE INDEX "Order_windowFrom_windowTo_idx" ON "Order"("windowFrom", "windowTo");

-- CreateIndex
CREATE INDEX "Order_status_completedAt_idx" ON "Order"("status", "completedAt");

-- CreateIndex
CREATE INDEX "Order_clientId_idx" ON "Order"("clientId");

-- CreateIndex
CREATE INDEX "Order_addressId_clientId_idx" ON "Order"("addressId", "clientId");

-- CreateIndex
CREATE INDEX "Order_leadId_idx" ON "Order"("leadId");

-- CreateIndex
CREATE INDEX "Order_serviceId_idx" ON "Order"("serviceId");

-- CreateIndex
CREATE INDEX "OrderCleaner_cleanerId_idx" ON "OrderCleaner"("cleanerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderCleaner_orderId_cleanerId_key" ON "OrderCleaner"("orderId", "cleanerId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderExtra_orderId_extraId_key" ON "OrderExtra"("orderId", "extraId");

-- CreateIndex
CREATE UNIQUE INDEX "DurationRule_serviceId_version_key" ON "DurationRule"("serviceId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "RouteCalculation_cacheKey_key" ON "RouteCalculation"("cacheKey");

-- CreateIndex
CREATE INDEX "RouteCalculation_expiresAt_idx" ON "RouteCalculation"("expiresAt");

-- CreateIndex
CREATE INDEX "Conversation_clientId_idx" ON "Conversation"("clientId");

-- CreateIndex
CREATE INDEX "Conversation_leadId_idx" ON "Conversation"("leadId");

-- CreateIndex
CREATE INDEX "Conversation_orderId_idx" ON "Conversation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Conversation_channel_externalThreadId_key" ON "Conversation"("channel", "externalThreadId");

-- CreateIndex
CREATE INDEX "Message_conversationId_sentAt_idx" ON "Message"("conversationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_conversationId_externalMessageId_key" ON "Message"("conversationId", "externalMessageId");

-- CreateIndex
CREATE INDEX "HumanHandoff_resolvedAt_requestedAt_idx" ON "HumanHandoff"("resolvedAt", "requestedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_payoutId_key" ON "Expense"("payoutId");

-- CreateIndex
CREATE INDEX "Expense_occurredAt_currency_idx" ON "Expense"("occurredAt", "currency");

-- CreateIndex
CREATE INDEX "Expense_orderId_idx" ON "Expense"("orderId");

-- CreateIndex
CREATE INDEX "CleanerPayout_cleanerId_status_idx" ON "CleanerPayout"("cleanerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CleanerPayout_orderId_cleanerId_key" ON "CleanerPayout"("orderId", "cleanerId");

-- CreateIndex
CREATE INDEX "Notification_status_scheduledAt_idx" ON "Notification"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_createdAt_idx" ON "AuditLog"("entityType", "entityId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cleaner" ADD CONSTRAINT "Cleaner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerAvailability" ADD CONSTRAINT "CleanerAvailability_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "Cleaner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePriceBand" ADD CONSTRAINT "ServicePriceBand_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_addressId_clientId_fkey" FOREIGN KEY ("addressId", "clientId") REFERENCES "ClientAddress"("id", "clientId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_durationRuleId_fkey" FOREIGN KEY ("durationRuleId") REFERENCES "DurationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCleaner" ADD CONSTRAINT "OrderCleaner_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCleaner" ADD CONSTRAINT "OrderCleaner_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "Cleaner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExtra" ADD CONSTRAINT "OrderExtra_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderExtra" ADD CONSTRAINT "OrderExtra_extraId_fkey" FOREIGN KEY ("extraId") REFERENCES "ServiceExtra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DurationRule" ADD CONSTRAINT "DurationRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanHandoff" ADD CONSTRAINT "HumanHandoff_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HumanHandoff" ADD CONSTRAINT "HumanHandoff_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "CleanerPayout"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerPayout" ADD CONSTRAINT "CleanerPayout_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "Cleaner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CleanerPayout" ADD CONSTRAINT "CleanerPayout_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_cleanerId_fkey" FOREIGN KEY ("cleanerId") REFERENCES "Cleaner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Business invariants. Kept in SQL because Prisma schema does not express CHECK.
ALTER TABLE "Cleaner" ADD CONSTRAINT "Cleaner_percent_rating_coordinates_check" CHECK (
  ("payoutPercent" IS NULL OR "payoutPercent" BETWEEN 0 AND 100)
  AND ("internalRating" IS NULL OR "internalRating" BETWEEN 0 AND 5)
  AND (("homeLatitude" IS NULL) = ("homeLongitude" IS NULL))
  AND ("homeLatitude" IS NULL OR "homeLatitude" BETWEEN -90 AND 90)
  AND ("homeLongitude" IS NULL OR "homeLongitude" BETWEEN -180 AND 180)
);
ALTER TABLE "CleanerAvailability" ADD CONSTRAINT "CleanerAvailability_period_check" CHECK (
  (("kind" = 'WEEKLY' AND "weekday" BETWEEN 1 AND 7 AND "weekday" IS NOT NULL AND "date" IS NULL)
    OR ("kind" <> 'WEEKLY' AND "date" IS NOT NULL AND "weekday" IS NULL))
  AND (("startMinute" IS NOT NULL AND "endMinute" IS NOT NULL AND "startMinute" >= 0 AND "endMinute" <= 1440 AND "startMinute" < "endMinute")
    OR ("kind" = 'UNAVAILABLE' AND "startMinute" IS NULL AND "endMinute" IS NULL))
);
ALTER TABLE "Client" ADD CONSTRAINT "Client_discount_check" CHECK ("discountPercent" IS NULL OR "discountPercent" BETWEEN 0 AND 100);
ALTER TABLE "ClientAddress" ADD CONSTRAINT "ClientAddress_coordinates_check" CHECK (
  (("latitude" IS NULL) = ("longitude" IS NULL))
  AND ("latitude" IS NULL OR "latitude" BETWEEN -90 AND 90)
  AND ("longitude" IS NULL OR "longitude" BETWEEN -180 AND 180)
);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lost_reason_check" CHECK ("status" <> 'LOST' OR length(trim("lostReason")) > 0 AND "lostReason" IS NOT NULL);
ALTER TABLE "ServicePriceBand" ADD CONSTRAINT "ServicePriceBand_range_check" CHECK (
  "minArea" >= 0 AND ("maxArea" IS NULL OR "maxArea" > "minArea")
  AND (("fixedPrice" IS NOT NULL AND "fixedPrice" >= 0 AND "pricePerSquare" IS NULL)
    OR ("pricePerSquare" IS NOT NULL AND "pricePerSquare" >= 0 AND "fixedPrice" IS NULL))
  AND ("validUntil" IS NULL OR "validUntil" > "validFrom")
);
ALTER TABLE "ServiceExtra" ADD CONSTRAINT "ServiceExtra_price_check" CHECK ("unitPrice" >= 0);
ALTER TABLE "Order" ADD CONSTRAINT "Order_amounts_duration_check" CHECK (
  "area" > 0 AND "requiredCleaners" > 0 AND "cleaningReserveMinutes" >= 0 AND "travelBufferMinutes" >= 0
  AND ("estimatedDurationMinutes" IS NULL OR "estimatedDurationMinutes" > 0)
  AND ("actualDurationMinutes" IS NULL OR "actualDurationMinutes" > 0)
  AND ("basePrice" IS NULL OR "basePrice" >= 0) AND ("finalPrice" IS NULL OR "finalPrice" >= 0) AND "discountAmount" >= 0
  AND (COALESCE("priceAdjustment", 0) = 0 OR ("priceChangeReason" IS NOT NULL AND length(trim("priceChangeReason")) > 0))
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_schedule_check" CHECK (
  ("scheduleMode" = 'FIXED' AND "windowFrom" IS NULL AND "windowTo" IS NULL AND ("status" IN ('DRAFT','CANCELLED') OR "scheduledStart" IS NOT NULL))
  OR ("scheduleMode" = 'FLEXIBLE' AND "windowFrom" IS NOT NULL AND "windowTo" IS NOT NULL AND "windowFrom" < "windowTo"
    AND ("scheduledStart" IS NULL OR "scheduledStart" >= "windowFrom" AND "scheduledStart" < "windowTo"))
);
ALTER TABLE "Order" ADD CONSTRAINT "Order_completion_check" CHECK (
  "status" <> 'COMPLETED' OR ("completedAt" IS NOT NULL AND "finalPrice" IS NOT NULL)
);
ALTER TABLE "OrderExtra" ADD CONSTRAINT "OrderExtra_amount_check" CHECK ("quantity" > 0 AND "unitPrice" >= 0 AND ("durationMinutes" IS NULL OR "durationMinutes" >= 0));
ALTER TABLE "DurationRule" ADD CONSTRAINT "DurationRule_values_check" CHECK (
  "version" > 0 AND "cleanerCount" > 0
  AND ("minArea" IS NULL OR "minArea" >= 0) AND ("maxArea" IS NULL OR "maxArea" > COALESCE("minArea", 0))
  AND ("baseMinutes" IS NULL OR "baseMinutes" > 0) AND ("minutesPerSquare" IS NULL OR "minutesPerSquare" > 0)
);
ALTER TABLE "RouteCalculation" ADD CONSTRAINT "RouteCalculation_values_check" CHECK ("durationSeconds" >= 0 AND "distanceMeters" >= 0 AND "expiresAt" > "calculatedAt");
ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_channel_check" CHECK ("channel" IN ('WEBSITE','TELEGRAM','WHATSAPP','VIBER'));
ALTER TABLE "HumanHandoff" ADD CONSTRAINT "HumanHandoff_reason_check" CHECK (length(trim("reason")) > 0 AND ("resolvedAt" IS NULL OR "resolvedAt" >= "requestedAt"));
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_amount_check" CHECK ("amount" >= 0 AND ("payoutId" IS NULL OR "category" = 'PAYOUT'));
ALTER TABLE "CleanerPayout" ADD CONSTRAINT "CleanerPayout_values_check" CHECK ("appliedPercent" BETWEEN 0 AND 100 AND "basisAmount" >= 0 AND "amount" >= 0 AND ("status" <> 'PAID' OR "paidAt" IS NOT NULL));
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_check" CHECK (num_nonnulls("clientId","cleanerId","userId") = 1 AND "attempts" >= 0);
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_check" CHECK (
  ("actorType" = 'USER' AND "userId" IS NOT NULL AND "actorKey" IS NULL)
  OR ("actorType" IN ('AI','SYSTEM') AND "userId" IS NULL AND "actorKey" IS NOT NULL)
);
ALTER TABLE "BusinessSettings" ADD CONSTRAINT "BusinessSettings_values_check" CHECK (
  "id" = 'default' AND "defaultTravelBufferMinutes" >= 0
  AND ("defaultCleanerPayoutPercent" IS NULL OR "defaultCleanerPayoutPercent" BETWEEN 0 AND 100)
  AND (("workdayStartMinute" IS NULL AND "workdayEndMinute" IS NULL)
    OR ("workdayStartMinute" IS NOT NULL AND "workdayEndMinute" IS NOT NULL AND "workdayStartMinute" >= 0 AND "workdayEndMinute" <= 1440 AND "workdayStartMinute" < "workdayEndMinute"))
);
-- Defaults only; no operational or fake customer data.
INSERT INTO "BusinessSettings" ("id", "updatedAt") VALUES ('default', CURRENT_TIMESTAMP);
