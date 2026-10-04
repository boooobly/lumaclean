-- Substring search used by the server-side CRM registries.
BEGIN;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Client_name_idx" ON "Client" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Client_phone_search_idx" ON "Client" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX "Client_telegram_idx" ON "Client" USING GIN ("telegram" gin_trgm_ops);
CREATE INDEX "Client_whatsapp_idx" ON "Client" USING GIN ("whatsapp" gin_trgm_ops);
CREATE INDEX "Client_viber_idx" ON "Client" USING GIN ("viber" gin_trgm_ops);
CREATE INDEX "Lead_name_idx" ON "Lead" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "Lead_phone_idx" ON "Lead" USING GIN ("phone" gin_trgm_ops);
CREATE INDEX "Lead_reference_idx" ON "Lead" USING GIN ("reference" gin_trgm_ops);
CREATE INDEX "Order_reference_idx" ON "Order" USING GIN ("reference" gin_trgm_ops);
COMMIT;
