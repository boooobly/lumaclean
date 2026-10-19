-- Permit genuine enquiries without a name. Existing values are preserved.
-- requestKind is already a string; CONTACT_REQUEST requires no enum rewrite.
ALTER TABLE "Lead" ALTER COLUMN "name" DROP NOT NULL;
