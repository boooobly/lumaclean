import type { Prisma } from "@/generated/prisma/client";
// One canonical accrual definition, also used in targeted integration checks.
export async function periodTotals(
  tx: Prisma.TransactionClient,
  period: { from: Date; to: Date },
) {
  const orderWhere = {
    status: "COMPLETED" as const,
    currency: "RSD",
    completedAt: { gte: period.from, lt: period.to },
  };
  const revenue = await tx.order.aggregate({
    where: orderWhere,
    _sum: { finalPrice: true },
    _count: true,
    _avg: { finalPrice: true },
  });
  const expenses = await tx.expense.aggregate({
    where: {
      currency: "RSD",
      deletedAt: null,
      payoutId: null,
      occurredAt: { gte: period.from, lt: period.to },
    },
    _sum: { amount: true },
    _count: true,
  });
  const payouts = await tx.cleanerPayout.aggregate({
    where: { currency: "RSD", status: { not: "CANCELLED" }, order: orderWhere },
    _sum: { amount: true },
  });
  return {
    revenue: Number(revenue._sum.finalPrice ?? 0),
    expenses: Number(expenses._sum.amount ?? 0),
    accrued: Number(payouts._sum.amount ?? 0),
    orderCount: revenue._count,
    average: Number(revenue._avg.finalPrice ?? 0),
    expenseCount: expenses._count,
  };
}
