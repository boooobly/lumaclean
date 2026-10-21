-- Extend the existing allowlist; no rows, historical values or Orders change.
ALTER TABLE "Lead"
  DROP CONSTRAINT "Lead_request_kind_check",
  ADD CONSTRAINT "Lead_request_kind_check"
    CHECK ("requestKind" IN ('CLEANING','CLEANING_UPHOLSTERY','UPHOLSTERY','CONTACT_REQUEST'));

-- A callback is never a quote or a booking.
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_contact_request_check" CHECK (
  "requestKind" <> 'CONTACT_REQUEST' OR (
    "name" IS NULL AND "serviceId" IS NULL AND "area" IS NULL
    AND "estimatedPrice" IS NULL AND "estimateText" IS NULL
    AND "urgent" = FALSE AND "upholsteryRequested" = FALSE
  )
);
