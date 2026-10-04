import type { Prisma } from "@/generated/prisma/client";

type Actor =
  { type: "USER"; userId: string } | { type: "AI" | "SYSTEM"; key: string };
type AuditedField =
  | "amount"
  | "appliedPercent"
  | "basisAmount"
  | "version"
  | "estimatedDurationMinutes"
  | "actualDurationMinutes"
  | "status"
  | "scheduledStart"
  | "windowFrom"
  | "windowTo"
  | "finalPrice"
  | "cleanerIds"
  | "active"
  | "changedFields"
  | "clientId"
  | "orderId"
  | "scheduleMode"
  | "basePrice"
  | "discountPercent"
  | "discountAmount"
  | "priceAdjustment"
  | "requiredCleaners"
  | "manualDurationMinutes"
  | "overrideCodes"
  | "date";
export type AuditChanges = Partial<
  Record<
    AuditedField,
    {
      before: string | string[] | boolean | null;
      after: string | string[] | boolean | null;
    }
  >
>;

const allowedFields = new Set<AuditedField>([
  "amount",
  "appliedPercent",
  "basisAmount",
  "version",
  "estimatedDurationMinutes",
  "actualDurationMinutes",
  "status",
  "scheduledStart",
  "windowFrom",
  "windowTo",
  "finalPrice",
  "cleanerIds",
  "active",
  "changedFields",
  "clientId",
  "orderId",
  "scheduleMode",
  "basePrice",
  "discountPercent",
  "discountAmount",
  "priceAdjustment",
  "requiredCleaners",
  "manualDurationMinutes",
  "overrideCodes",
  "date",
]);
// Commands pass the same transaction used for their business mutation.
export async function writeAudit(
  tx: Prisma.TransactionClient,
  actor: Actor,
  event: {
    action: string;
    entityType: string;
    entityId: string;
    changes?: AuditChanges;
  },
) {
  const safeChanges = event.changes
    ? Object.fromEntries(
        Object.entries(event.changes).filter(
          ([key, value]) =>
            allowedFields.has(key as AuditedField) && value !== undefined,
        ),
      )
    : undefined;
  return tx.auditLog.create({
    data: {
      actorType: actor.type,
      userId: actor.type === "USER" ? actor.userId : null,
      actorKey: actor.type !== "USER" ? actor.key : null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      changes: safeChanges as Prisma.InputJsonValue | undefined,
    },
  });
}
