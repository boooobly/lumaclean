import type { Prisma } from "@/generated/prisma/client";
import { payoutSnapshot } from "@/lib/domain/finance";
import { actualDuration } from "@/lib/domain/duration";
import { writeAudit } from "./audit";
export async function completeEconomics(
  tx: Prisma.TransactionClient,
  orderId: string,
  userId: string,
) {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status !== "COMPLETED" || order.historical) return;
  const assignments = await tx.orderCleaner.findMany({
    where: { orderId, removedAt: null },
    include: { cleaner: true },
  });
  const actual = actualDuration(assignments);
  await tx.order.update({
    where: { id: orderId },
    data: { actualDurationMinutes: actual },
  });
  if (order.historical || order.finalPrice === null) return;
  const settings = await tx.businessSettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  for (const a of assignments) {
    const snapshot = payoutSnapshot(
      Number(order.finalPrice),
      a.cleaner.payoutPercent === null ? null : Number(a.cleaner.payoutPercent),
      settings.defaultCleanerPayoutPercent === null
        ? null
        : Number(settings.defaultCleanerPayoutPercent),
    );
    if (!snapshot) continue;
    const existing = await tx.cleanerPayout.findUnique({
      where: { orderId_cleanerId: { orderId, cleanerId: a.cleanerId } },
    });
    if (existing) continue;
    const payout = await tx.cleanerPayout.create({
      data: {
        orderId,
        cleanerId: a.cleanerId,
        ...snapshot,
        currency: order.currency,
      },
    });
    await writeAudit(
      tx,
      { type: "USER", userId },
      {
        action: "PAYOUT_CREATED",
        entityType: "CleanerPayout",
        entityId: payout.id,
        changes: {
          amount: { before: null, after: String(snapshot.amount) },
          appliedPercent: {
            before: null,
            after: String(snapshot.appliedPercent),
          },
          basisAmount: { before: null, after: String(snapshot.basisAmount) },
        },
      },
    );
  }
}
