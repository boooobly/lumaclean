-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "closedAt" TIMESTAMPTZ(3),
ADD COLUMN     "displayAlias" TEXT NOT NULL DEFAULT 'Anna',
ADD COLUMN     "operatorTypingUntil" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "readAt" TIMESTAMPTZ(3),
ADD COLUMN     "responseToMessageId" TEXT;

-- CreateTable
CREATE TABLE "ChatAttachment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "messageId" TEXT,
    "requestId" TEXT NOT NULL,
    "uploader" TEXT NOT NULL DEFAULT 'CLIENT',
    "storageKey" TEXT NOT NULL,
    "thumbnailKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "processingStatus" TEXT NOT NULL DEFAULT 'READY',
    "aiAnalysisStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatAttachment_storageKey_key" ON "ChatAttachment"("storageKey");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAttachment_thumbnailKey_key" ON "ChatAttachment"("thumbnailKey");

-- CreateIndex
CREATE INDEX "ChatAttachment_messageId_idx" ON "ChatAttachment"("messageId");

-- CreateIndex
CREATE INDEX "ChatAttachment_conversationId_createdAt_idx" ON "ChatAttachment"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatAttachment_conversationId_requestId_key" ON "ChatAttachment"("conversationId", "requestId");

-- CreateIndex
CREATE UNIQUE INDEX "Message_responseToMessageId_key" ON "Message"("responseToMessageId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_responseToMessageId_fkey" FOREIGN KEY ("responseToMessageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAttachment" ADD CONSTRAINT "ChatAttachment_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Stable aliases for existing conversations; no user records or historical orders are changed.
UPDATE "Conversation" SET "displayAlias" = (ARRAY['Anna','Sofia','Mila','Elena','Nina','Maria','Sara','Maya','Natalia','Aleksandra'])[1 + get_byte(decode(md5(id),'hex'),0) % 10];
UPDATE "Conversation" SET "closedAt" = "updatedAt" WHERE control = 'CLOSED';

-- Bind the earliest historical answer to its real CLIENT source. Preserve any historical
-- duplicate rows intact rather than deleting customer history. All future answers are unique.
WITH sources AS (
 SELECT m.id, j."messageId", row_number() OVER (PARTITION BY j."messageId" ORDER BY m."sentAt", m.id) AS position
 FROM "Message" m JOIN "AgentJob" j ON j.id = split_part(m."externalMessageId", ':', 2)
 JOIN "Message" inbound ON inbound.id = j."messageId" AND inbound.author = 'CLIENT'
 WHERE m.author = 'AI' AND m."externalMessageId" LIKE 'agent:%' AND m."conversationId" = inbound."conversationId"
) UPDATE "Message" m SET "responseToMessageId" = sources."messageId" FROM sources WHERE m.id = sources.id AND sources.position = 1;

CREATE FUNCTION chat_response_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."responseToMessageId" IS NOT NULL AND (NEW.author <> 'AI' OR NOT EXISTS (
   SELECT 1 FROM "Message" source WHERE source.id=NEW."responseToMessageId" AND source.author='CLIENT' AND source."conversationId"=NEW."conversationId"
 )) THEN RAISE EXCEPTION 'Invalid chat response source'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER chat_response_source_guard BEFORE INSERT OR UPDATE OF "responseToMessageId", "conversationId", author ON "Message" FOR EACH ROW EXECUTE FUNCTION chat_response_source_guard();
