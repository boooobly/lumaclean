import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type Actor =
  { type: "USER"; userId: string } | { type: "AI" | "SYSTEM"; key: string };
type AuditedField =
  | "status"
  | "scheduledStart"
  | "windowFrom"
  | "windowTo"
  | "finalPrice"
  | "cleanerIds"
  | "active";
export type AuditChanges = Partial<
  Record<
    AuditedField,
    {
      before: string | string[] | boolean | null;
      after: string | string[] | boolean | null;
    }
  >
>;

// Future commands pass the same transaction used for their business mutation.
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
  return tx.auditLog.create({
    data: {
      actorType: actor.type,
      userId: actor.type === "USER" ? actor.userId : null,
      actorKey: actor.type !== "USER" ? actor.key : null,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      changes: event.changes as Prisma.InputJsonValue | undefined,
    },
  });
}
