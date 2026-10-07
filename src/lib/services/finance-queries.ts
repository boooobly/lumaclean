import "server-only";
import { getDatabase } from "@/lib/database/client";
import { requireAdmin } from "@/lib/auth/session";
import { financePeriod, economics } from "@/lib/domain/finance";
import { durationAccuracy } from "@/lib/domain/duration";
import { soilLabels } from "@/lib/domain/crm-types";
import { periodTotals, completedPeriodWhere } from "./finance-calculation";
import { durationConfig } from "./duration-engine";
export async function getDurationSettings() {
  await requireAdmin();
  const db = getDatabase();
  const settings = await db.businessSettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  return {
    rules: (
      await db.durationRule.findMany({
        orderBy: [{ serviceId: "asc" }, { version: "desc" }],
      })
    ).map(durationConfig),
    services: await db.service.findMany({
      select: { id: true, code: true, name: true },
    }),
    defaultPercent: settings.defaultCleanerPayoutPercent?.toString() ?? null,
    timezone: settings.timezone,
    currency: settings.currency,
    travelBufferMinutes: settings.defaultTravelBufferMinutes,
  };
}
export async function getFinances(input: {
  period?: string;
  from?: string;
  to?: string;
  page?: string;
}) {
  await requireAdmin();
  const db = getDatabase(),
    period = financePeriod(input),
    page = Math.min(10000, Math.max(1, Math.floor(Number(input.page) || 1)));
  return db.$transaction(
    async (tx) => {
      const orderWhere = completedPeriodWhere(period);
      const expenseWhere = {
        currency: "RSD",
        deletedAt: null,
        payoutId: null,
        occurredAt: { gte: period.from, lt: period.to },
      };
      const payoutWhere = {
        currency: "RSD",
        status: { not: "CANCELLED" as const },
        order: orderWhere,
      };
      const totals = await periodTotals(tx, period);
      const paid = await tx.cleanerPayout.aggregate({
        where: { ...payoutWhere, status: "PAID" },
        _sum: { amount: true },
      });
      const categories = await tx.expense.groupBy({
        by: ["category"],
        where: expenseWhere,
        _sum: { amount: true },
      });
      const expenseRows = await tx.expense.findMany({
        where: expenseWhere,
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 30,
        take: 30,
      });
      const payouts = await tx.cleanerPayout.findMany({
        where: { currency: "RSD", order: orderWhere },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 30,
        take: 30,
      });
      const payoutCount = await tx.cleanerPayout.count({
        where: { currency: "RSD", order: orderWhere },
      });
      const cleaners = await tx.cleaner.findMany({
        where: { id: { in: [...new Set(payouts.map((p) => p.cleanerId).filter((id): id is string => id !== null))] } },
        select: { id: true, name: true },
      });
      const orders = await tx.order.findMany({
        where: { id: { in: [...new Set(payouts.map((p) => p.orderId))] } },
        select: { id: true, reference: true, finalPrice: true },
      });
      // Count missing per order/assignment, including cleaners with payouts on other orders.
      const missingRows = await tx.$queryRaw<
        { count: bigint }[]
      >`SELECT COUNT(DISTINCT o.id) AS count FROM "Order" o JOIN "OrderCleaner" a ON a."orderId"=o.id AND a."removedAt" IS NULL LEFT JOIN "CleanerPayout" p ON p."orderId"=o.id AND p."cleanerId"=a."cleanerId" WHERE o.status='COMPLETED' AND NOT o.historical AND o.currency='RSD' AND o."completedAt">=${period.from} AND o."completedAt"<${period.to} AND p.id IS NULL`;
      const legacyUnreviewed = await tx.order.count({
        where: {
          ...orderWhere,
          historical: true,
          legacyFinance: { path: ["status"], equals: "UNREVIEWED" },
        },
      });
      const investments = await tx.investment.findMany({
        orderBy: { occurredAt: "desc" },
        take: 30,
      });
      const recentOrders = await tx.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, reference: true },
      });
      const referencedOrders = await tx.order.findMany({
        where: {
          id: {
            in: expenseRows
              .map((e) => e.orderId)
              .filter(
                (id): id is string =>
                  !!id && !recentOrders.some((o) => o.id === id),
              ),
          },
        },
        select: { id: true, reference: true },
      });
      const months = await tx.$queryRaw<
        { month: string; revenue: string; orders: bigint }[]
      >`SELECT to_char(COALESCE("historicalServiceDate",("completedAt" AT TIME ZONE 'Europe/Belgrade')::date),'YYYY-MM') AS month,SUM("finalPrice")::text AS revenue,COUNT(*) AS orders FROM "Order" WHERE status='COMPLETED' AND currency='RSD' AND COALESCE("historicalServiceDate",("completedAt" AT TIME ZONE 'Europe/Belgrade')::date)>=${period.fromLabel}::date AND COALESCE("historicalServiceDate",("completedAt" AT TIME ZONE 'Europe/Belgrade')::date)<(${period.toLabel}::date + 1) GROUP BY 1 ORDER BY 1`;
      const rev = totals.revenue,
        exp = totals.expenses,
        pay = totals.accrued;
      return {
        orderOptions: [...recentOrders, ...referencedOrders],
        period,
        page,
        revenue: rev,
        expenses: exp,
        accrued: pay,
        paid: Number(paid._sum.amount ?? 0),
        profit: Math.round((rev - exp - pay) * 100) / 100,
        orderCount: totals.orderCount,
        average: totals.average,
        categories: categories.map((c) => ({
          category: c.category,
          amount: Number(c._sum.amount ?? 0),
        })),
        expenseCount: totals.expenseCount,
        expenseRows: expenseRows.map((e) => ({
          ...e,
          source: e.legacyFinance && typeof e.legacyFinance === "object" && !Array.isArray(e.legacyFinance) ? {paidBy: String(e.legacyFinance.paidBy ?? ""), reimbursed: String(e.legacyFinance.reimbursed ?? ""), comment: String(e.legacyFinance.sourceComment ?? "")} : null,
          amount: Number(e.amount),
          occurredAt: e.occurredAt.toISOString(),
          updatedAt: e.updatedAt.toISOString(),
          createdAt: undefined,
          deletedAt: undefined,
        })),
        payoutCount,
        payouts: payouts.map((p) => ({
          ...p,
          amount: Number(p.amount),
          basisAmount: p.basisAmount === null ? null : Number(p.basisAmount),
          appliedPercent: p.appliedPercent === null ? null : Number(p.appliedPercent),
          updatedAt: p.updatedAt.toISOString(),
          paidAt: p.paidAt?.toISOString() ?? null,
          createdAt: undefined,
          cleaner: cleaners.find((c) => c.id === p.cleanerId)?.name ?? p.recipientName ?? "Клинер",
          reference:
            orders.find((o) => o.id === p.orderId)?.reference ?? p.orderId,
          finalPrice: Number(
            orders.find((o) => o.id === p.orderId)?.finalPrice ?? 0,
          ),
        })),
        missing: Number(missingRows[0]?.count ?? 0),
        legacyUnreviewed,
        investments: investments.map((i) => ({
          ...i,
          amount: Number(i.amount),
          returnedAmount: Number(i.returnedAmount),
          occurredAt: i.occurredAt.toISOString(),
          createdAt: undefined,
        })),
        months: months.map((m) => ({
          ...m,
          orders: Number(m.orders),
          revenue: Number(m.revenue),
        })),
      };
    },
    { isolationLevel: "RepeatableRead", timeout: 30000 },
  );
}
export async function getOrderEconomics(id: string) {
  await requireAdmin();
  const db = getDatabase(),
    o = await db.order.findUniqueOrThrow({ where: { id } });
  const expenses = await db.expense.findMany({
      where: { orderId: id, deletedAt: null, currency: o.currency },
    }),
    payouts = await db.cleanerPayout.findMany({
      where: { orderId: id, currency: o.currency },
    }),
    assignments = await db.orderCleaner.findMany({
      where: { orderId: id, removedAt: null },
      include: { cleaner: true },
    });
  const defaultPercent = (
    await db.businessSettings.findUniqueOrThrow({ where: { id: "default" } })
  ).defaultCleanerPayoutPercent;
  return {
    ...economics(
      Number(o.finalPrice ?? 0),
      expenses.map((e) => ({ amount: Number(e.amount), payoutId: e.payoutId })),
      payouts.map((p) => ({ amount: Number(p.amount), status: p.status })),
    ),
    missing: assignments
      .filter((a) => !payouts.some((p) => p.cleanerId === a.cleanerId))
      .map((a) => ({
        name: a.cleaner.name,
        configured: a.cleaner.payoutPercent !== null || defaultPercent !== null,
      })),
    assignments: assignments.map((a) => ({
      id: a.id,
      name: a.cleaner.name,
      startedAt: a.startedAt,
      finishedAt: a.finishedAt,
    })),
    legacy: o.legacyFinance,
  };
}
export async function getCleanerFinance(id: string) {
  await requireAdmin();
  const db = getDatabase();
  const orders = await db.order.aggregate({
    where: {
      status: "COMPLETED",
      currency: "RSD",
      assignments: { some: { cleanerId: id, removedAt: null } },
    },
    _sum: { finalPrice: true },
    _count: true,
  });
  const payouts = await db.cleanerPayout.groupBy({
    by: ["status"],
    where: { cleanerId: id, currency: "RSD" },
    _sum: { amount: true },
  });
  const current = await db.cleaner.findUniqueOrThrow({ where: { id } }),
    s = await db.businessSettings.findUniqueOrThrow({
      where: { id: "default" },
    });
  const total = (status: string) =>
    Number(payouts.find((p) => p.status === status)?._sum.amount ?? 0);
  return {
    orders: orders._count,
    revenue: Number(orders._sum.finalPrice ?? 0),
    accrued: total("PENDING") + total("PAID"),
    paid: total("PAID"),
    pending: total("PENDING"),
    percent:
      (current.payoutPercent ?? s.defaultCleanerPayoutPercent)?.toString() ??
      null,
  };
}
export async function getDurationAnalytics() {
  await requireAdmin();
  const db = getDatabase();
  const rows = await db.$queryRaw<
    { service: string; planned: number; actual: number; band: string }[]
  >`SELECT s.name AS service,COALESCE(o."manualDurationMinutes",o."estimatedDurationMinutes") AS planned,o."actualDurationMinutes" AS actual,CASE WHEN r.id IS NOT NULL THEN concat(COALESCE(r."minArea",0),'–',COALESCE(r."maxArea",10000),' м² / ',r."cleanerCount",' клинера / ',COALESCE(o."soilLevel"::text,'NORMAL')) ELSE 'Ручное планирование' END AS band FROM "Order" o JOIN "Service" s ON s.id=o."serviceId" LEFT JOIN "DurationRule" r ON r.id=o."durationRuleId" WHERE o.status='COMPLETED' AND o."actualDurationMinutes" IS NOT NULL AND COALESCE(o."manualDurationMinutes",o."estimatedDurationMinutes") IS NOT NULL ORDER BY o."completedAt" DESC LIMIT 10001`;
  return {
    groups: durationAccuracy(
      rows
        .slice(0, 10000)
        .map((r) => ({
          ...r,
          band: r.band.replace(
            /(LIGHT|NORMAL|HEAVY|EXTREME)$/,
            (code) => soilLabels[code as keyof typeof soilLabels],
          ),
        })),
    ),
    count: rows.length,
    capped: rows.length > 10000,
  };
}
