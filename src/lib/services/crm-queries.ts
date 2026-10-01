import "server-only";
import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { entityId } from "@/lib/validation/crm";
import {
  leadWhere,
  clientWhere,
  orderWhere,
  listOptions,
  scalar,
  type Query,
} from "@/lib/domain/crm-filters";
import { CrmError } from "@/lib/domain/crm";
import { notFound } from "next/navigation";
// Replace raw driver errors before they reach framework logs or the error boundary.
async function read<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CrmError) throw error;
    throw new Error("CRM temporarily unavailable");
  }
}
export async function listLeads(query: Query) {
  await requireAdmin();
  const db = getDatabase(),
    options = listOptions(query),
    where = leadWhere(query);
  const [count, rows] = await read(() =>
    db.$transaction([
      db.lead.count({ where }),
      db.lead.findMany({
        where,
        skip: (options.page - 1) * options.size,
        take: options.size,
        orderBy: [{ createdAt: options.sort }, { id: options.sort }],
        select: {
          id: true,
          reference: true,
          createdAt: true,
          name: true,
          phone: true,
          status: true,
          channel: true,
          estimatedPrice: true,
          service: { select: { name: true } },
          client: { select: { id: true, name: true } },
        },
      }),
    ]),
  );
  return { ...options, count, rows };
}
export async function listClients(query: Query) {
  await requireAdmin();
  const db = getDatabase(),
    options = listOptions(query),
    where = clientWhere(query);
  const [count, rows] = await read(() =>
    db.$transaction([
      db.client.count({ where }),
      db.client.findMany({
        where,
        skip: (options.page - 1) * options.size,
        take: options.size,
        orderBy:
          scalar(query, "sort") === "name"
            ? [{ name: "asc" }, { id: "asc" }]
            : [{ createdAt: options.sort }, { id: options.sort }],
        select: {
          id: true,
          name: true,
          phone: true,
          preferredChannel: true,
          createdAt: true,
          _count: { select: { orders: true } },
          orders: {
            take: 1,
            orderBy: { createdAt: "desc" },
            select: { scheduledStart: true, windowFrom: true, createdAt: true },
          },
        },
      }),
    ]),
  );
  const totals = await read(() =>
    db.order.groupBy({
      by: ["clientId"],
      where: {
        clientId: { in: rows.map((r) => r.id) },
        status: "COMPLETED",
        currency: "RSD",
      },
      _sum: { finalPrice: true },
    }),
  );
  return {
    ...options,
    count,
    rows: rows.map((row) => ({
      ...row,
      revenue:
        totals.find((t) => t.clientId === row.id)?._sum.finalPrice ?? null,
    })),
  };
}
export async function listOrders(query: Query) {
  await requireAdmin();
  const db = getDatabase(),
    options = listOptions(query),
    where = orderWhere(query);
  const [count, rows] = await read(() =>
    db.$transaction([
      db.order.count({ where }),
      db.order.findMany({
        where,
        skip: (options.page - 1) * options.size,
        take: options.size,
        orderBy:
          scalar(query, "sort") === "scheduled"
            ? [{ scheduledStart: "asc" }, { windowFrom: "asc" }, { id: "asc" }]
            : [{ createdAt: options.sort }, { id: options.sort }],
        select: {
          id: true,
          reference: true,
          createdAt: true,
          area: true,
          scheduleMode: true,
          scheduledStart: true,
          windowFrom: true,
          windowTo: true,
          estimatedDurationMinutes: true,
          manualDurationMinutes: true,
          finalPrice: true,
          currency: true,
          status: true,
          client: { select: { id: true, name: true, phone: true } },
          address: { select: { fullAddress: true } },
          service: { select: { name: true } },
        },
      }),
    ]),
  );
  return { ...options, count, rows };
}
function checkedId(id: string) {
  if (!entityId.safeParse(id).success) notFound();
}
export async function getLead(id: string) {
  await requireAdmin();
  checkedId(id);
  const db = getDatabase();
  const lead = await read(() =>
    db.lead.findUnique({
      where: { id },
      include: {
        service: { select: { code: true, name: true } },
        extras: { include: { extra: { select: { code: true, name: true } } } },
        client: { select: { id: true, name: true, phone: true } },
        orders: {
          take: 10,
          select: { id: true, reference: true, status: true },
        },
      },
    }),
  );
  if (!lead) notFound();
  return lead;
}
export async function getClient(id: string) {
  await requireAdmin();
  checkedId(id);
  const db = getDatabase();
  const client = await read(() =>
    db.client.findUnique({
      where: { id },
      include: {
        addresses: {
          orderBy: [{ active: "desc" }, { createdAt: "asc" }],
          take: 100,
        },
        leads: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: { id: true, reference: true, status: true, createdAt: true },
        },
        orders: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            reference: true,
            status: true,
            scheduledStart: true,
            windowFrom: true,
            finalPrice: true,
            currency: true,
          },
        },
        _count: { select: { orders: true, leads: true, addresses: true } },
      },
    }),
  );
  if (!client) notFound();
  const [stats, last] = await read(() =>
    db.$transaction([
      db.order.aggregate({
        where: { clientId: id, status: "COMPLETED", currency: "RSD" },
        _sum: { finalPrice: true },
        _avg: { finalPrice: true },
        _count: true,
      }),
      db.order.findFirst({
        where: { clientId: id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        select: { completedAt: true },
      }),
    ]),
  );
  return { client, stats, last };
}
export async function getOrder(id: string) {
  await requireAdmin();
  checkedId(id);
  const order = await read(() =>
    getDatabase().order.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            phone: true,
            telegram: true,
            whatsapp: true,
            viber: true,
            preferredChannel: true,
          },
        },
        address: true,
        service: { select: { name: true, code: true } },
        extras: { include: { extra: { select: { code: true, name: true } } } },
        lead: { select: { id: true, reference: true } },
      },
    }),
  );
  if (!order) notFound();
  return order;
}
export async function getHistory(entityType: string, entityId: string) {
  await requireAdmin();
  return read(() =>
    getDatabase().auditLog.findMany({
      where: { entityType, entityId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
      select: {
        id: true,
        action: true,
        actorType: true,
        createdAt: true,
        changes: true,
        user: { select: { name: true } },
      },
    }),
  );
}
export async function findClientOptions(q: string, id?: string) {
  await requireAdmin();
  const db = getDatabase();
  return read(() =>
    db.client.findMany({
      where: id ? { id } : clientWhere({ q }),
      orderBy: { name: "asc" },
      take: 10,
      select: {
        id: true,
        name: true,
        phone: true,
        discountPercent: true,
        addresses: {
          where: { active: true },
          take: 30,
          orderBy: { createdAt: "asc" },
          select: { id: true, label: true, fullAddress: true },
        },
      },
    }),
  );
}
