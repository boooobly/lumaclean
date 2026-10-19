-- Website lead delivery targets the configured manager chat, even if no CRM admin
-- is active yet. Preserve the one-recipient rule for all other notification kinds.
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_recipient_check";
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_recipient_check" CHECK (
  "attempts" >= 0 AND (
    num_nonnulls("clientId", "cleanerId", "userId") = 1 OR (
      num_nonnulls("clientId", "cleanerId", "userId") = 0 AND
      "kind" = 'WEBSITE_LEAD' AND "audience" = 'ADMIN' AND "channel" = 'TELEGRAM' AND
      "eventKey" IS NOT NULL AND "payload"->>'leadId' IS NOT NULL
    ) IS TRUE
  )
);
