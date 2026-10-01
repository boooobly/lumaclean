import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { businessPeriods } from "@/lib/domain/time";

export async function getDashboard() {
  await requireAdmin();
  const db = getDatabase();
  const settings = await db.businessSettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  const now = new Date();
  const { dayFrom, dayTo, monthFrom, monthTo } = businessPeriods(
    now,
    settings.timezone,
  );
  const [today, leads, clients, cleaners, revenue, expenses, latestLeads] =
    await Promise.all([
      db.order.count({
        where: {
          status: {
            in: [
              "CONFIRMED",
              "SCHEDULED",
              "EN_ROUTE",
              "IN_PROGRESS",
              "COMPLETED",
            ],
          },
          OR: [
            { scheduledStart: { gte: dayFrom, lt: dayTo } },
            {
              scheduleMode: "FLEXIBLE",
              scheduledStart: null,
              windowFrom: { lt: dayTo },
              windowTo: { gt: dayFrom },
            },
          ],
        },
      }),
      db.lead.count({ where: { status: "NEW" } }),
      db.client.count(),
      db.cleaner.count({ where: { active: true } }),
      db.order.aggregate({
        where: {
          status: "COMPLETED",
          completedAt: { gte: monthFrom, lt: monthTo },
          currency: settings.currency,
        },
        _sum: { finalPrice: true },
      }),
      db.expense.aggregate({
        where: {
          deletedAt: null,
          payoutId: null,
          occurredAt: { gte: monthFrom, lt: monthTo },
          currency: settings.currency,
        },
        _sum: { amount: true },
      }),
      db.lead.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          createdAt: true,
          status: true,
          service: { select: { name: true } },
        },
      }),
    ]);
  return {
    today,
    leads,
    clients,
    cleaners,
    revenue: revenue._sum.finalPrice?.toString() || "0",
    expenses: expenses._sum.amount?.toString() || "0",
    timezone: settings.timezone,
    currency: settings.currency,
    now,
    latestLeads,
  };
}
