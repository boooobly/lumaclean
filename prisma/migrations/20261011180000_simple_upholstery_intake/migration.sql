-- Additive intake metadata; historical orders, quotes and financial snapshots are untouched.
ALTER TABLE "Lead" ADD COLUMN "requestKind" TEXT NOT NULL DEFAULT 'CLEANING',
 ADD COLUMN "upholsteryRequested" BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN "humanReviewRequired" BOOLEAN NOT NULL DEFAULT FALSE,
 ADD COLUMN "consentAt" TIMESTAMPTZ(3);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_request_kind_check" CHECK ("requestKind" IN ('CLEANING','CLEANING_UPHOLSTERY','UPHOLSTERY'));
