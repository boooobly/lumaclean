import "server-only";
import { Temporal } from "@js-temporal/polyfill";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { localInput } from "@/lib/domain/crm";
import {
  calendarRange,
  SchedulingConflictService,
  plannedEnd,
  type PlanningOrder,
} from "@/lib/domain/scheduling-conflicts";
import {
  durationOf,
  type CalendarData,
  type CalendarOrder,
} from "@/lib/domain/scheduling-types";
import { dateOnly } from "@/lib/validation/scheduling";
import { entityId } from "@/lib/validation/crm";
import { notFound } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { assessScheduling } from "./scheduling-commands";
import {
  assessTravel,
  routeIssues,
  travelRequests,
  type RoutingSnapshot,
} from "@/lib/domain/logistics";
import { RoutingService } from "./route-cache";
import { geo } from "@/lib/domain/routing";
const calendarSelect = {
  client: { select: { name: true } },
  address: {
    select: {
      fullAddress: true,
      latitude: true,
      longitude: true,
      placeId: true,
      coordinatesConfirmed:true,
    },
  },
  service: { select: { name: true } },
  assignments: {
    where: { removedAt: null },
    select: { cleaner: { select: { id: true, name: true, active: true } } },
  },
} satisfies Prisma.OrderInclude;
type Row = Prisma.OrderGetPayload<{ include: typeof calendarSelect }>;
const planning = (row: Row): PlanningOrder => ({
  ...row,
  cleanerIds: row.assignments.map((a) => a.cleaner.id),
});
function dto(row: Row, issues: CalendarOrder["issues"] = []): CalendarOrder {
  return {
    id: row.id,
    reference: row.reference ?? row.id,
    client: row.client.name,
    address: row.address.fullAddress,
    service: row.service?.name ?? "Историческая услуга",
    status: row.status,
    scheduleMode: row.scheduleMode,
    start: row.scheduledStart?.toISOString() ?? null,
    end: row.scheduledEnd?.toISOString() ?? null,
    windowFrom: row.windowFrom?.toISOString() ?? null,
    windowTo: row.windowTo?.toISOString() ?? null,
    localStart: localInput(row.scheduledStart),
    duration: durationOf(row),
    manualDuration: row.manualDurationMinutes,
    requiredCleaners: row.requiredCleaners,
    cleaners: row.assignments.map((a) => a.cleaner),
    updatedAt: row.updatedAt.toISOString(),
    issues,
  };
}
export const calendarQuery = z.object({
  mode: z.enum(["day", "week", "month"]).default("week"),
  date: dateOnly.default(() =>
    Temporal.Now.plainDateISO("Europe/Belgrade").toString(),
  ),
  cleanerId: entityId.optional(),
});
export async function getCalendarData(
  query: { mode?: string; date?: string; cleanerId?: string } = {},
): Promise<CalendarData> {
  await requireAdmin();
  const input = calendarQuery.parse(query),
    range = calendarRange(input.mode, input.date),
    db = getDatabase();
  const from = new Date(range.from.getTime() - 86400000),
    to = new Date(range.to.getTime() + 86400000);
  const availability = {
    where: {
      OR: [{ kind: "WEEKLY" as const }, { date: { gte: from, lte: to } }],
    },
  };
  const [rows, crew, settings] = await Promise.all([
    db.order.findMany({
      where: {
        OR: [
          {
            scheduledStart: { lt: to },
            OR: [
              { scheduledEnd: { gt: from } },
              { scheduledEnd: null, scheduledStart: { gte: from } },
            ],
          },
          {
            scheduledStart: null,
            scheduleMode: "FLEXIBLE",
            windowFrom: { lt: to },
            windowTo: { gt: from },
          },
        ],
      },
      include: calendarSelect,
      orderBy: [{ scheduledStart: "asc" }, { id: "asc" }],
      take: 1001,
    }),
    db.cleaner.findMany({
      where: {
        OR: [
          { active: true },
          ...(input.cleanerId ? [{ id: input.cleanerId }] : []),
        ],
      },
      include: { availability },
      orderBy: { name: "asc" },
      take: 201,
    }),
    db.businessSettings.findUniqueOrThrow({ where: { id: "default" } }),
  ]);
  const cleanRows = rows.slice(0, 1000),
    cleaners = crew.slice(0, 200);
  const missing = [
    ...new Set(
      cleanRows
        .flatMap((r) => r.assignments.map((a) => a.cleaner.id))
        .filter((id) => !cleaners.some((c) => c.id === id)),
    ),
  ];
  if (missing.length)
    cleaners.push(
      ...(await db.cleaner.findMany({
        where: { id: { in: missing } },
        include: { availability },
      })),
    );
  const allPlans = cleanRows.map(planning);
  const visible = cleanRows.filter((r) => {
    const inRange = r.scheduledStart
      ? r.scheduledStart < range.to &&
        (r.scheduledEnd
          ? r.scheduledEnd > range.from
          : r.scheduledStart >= range.from)
      : Boolean(
          r.windowFrom &&
          r.windowTo &&
          r.windowFrom < range.to &&
          r.windowTo > range.from,
        );
    return (
      inRange &&
      (!input.cleanerId ||
        !r.assignments.length ||
        r.assignments.some((a) => a.cleaner.id === input.cleanerId))
    );
  });
  const snapshots: RoutingSnapshot[] = range.days.map((date) => ({
    date,
    version: "",
    defaultBuffer: settings.defaultTravelBufferMinutes,
    orders: cleanRows.map((r) => ({
      ...planning(r),
      addressId: r.addressId,
      updatedAt: r.updatedAt.toISOString(),
      reference: r.reference ?? r.id,
      label: r.address.fullAddress,
      point: r.address.coordinatesConfirmed?geo(r.address.latitude, r.address.longitude, r.address.placeId):null,
    })),
    cleaners: cleaners.map((c) => ({
      ...c,
      updatedAt: c.updatedAt.toISOString(),
      home: c.homeCoordinatesConfirmed?geo(c.homeLatitude, c.homeLongitude, c.homePlaceId):null,
    })),
  }));
  const cached = await new RoutingService(db).prepare(
    snapshots
      .flatMap((s) => travelRequests(s).map((l) => l.request))
      .slice(0, 5000),
    true,
  );
  const legs = snapshots.flatMap((s) => assessTravel(s, cached));
  const logisticsIssues = routeIssues(legs);
  return {
    mode: input.mode,
    date: input.date,
    from: range.days[0],
    to: range.days.at(-1)!,
    days: range.days,
    orders: visible.map((r) => {
      const candidate = planning(r),
        end = plannedEnd(candidate);
      const related = candidate.scheduledStart
        ? allPlans.filter(
            (p) =>
              p.scheduledStart &&
              p.scheduledStart.getTime() <
                (end ?? candidate.scheduledStart!).getTime() + 86400000 &&
              (plannedEnd(p)?.getTime() ?? p.scheduledStart.getTime()) >
                candidate.scheduledStart!.getTime() - 86400000,
          )
        : [];
      const result = dto(r, [
        ...SchedulingConflictService.check(
          candidate,
          cleaners,
          related,
          settings.defaultTravelBufferMinutes,
        ),
        ...logisticsIssues.filter((i) => i.orderId === r.id),
        ...(!["COMPLETED", "CANCELLED", "NO_SHOW"].includes(r.status) &&
        r.address.latitude === null
          ? [
              {
                code: "ADDRESS_UNVERIFIED",
                key: "ADDRESS_UNVERIFIED:" + r.addressId,
                severity: "WARNING" as const,
                message: "Адрес уборки не определён — маршрут не подтверждён.",
              },
            ]
          : []),
      ]);
      result.logistics = legs
        .filter((l) => l.orderId === r.id)
        .map((l) => ({
          cleaner: l.cleaner,
          origin: l.origin,
          destination: l.destination,
          minutes:
            l.route.status === "VERIFIED"
              ? Math.ceil(l.route.durationSeconds! / 60)
              : null,
          buffer: l.bufferMinutes,
          status: l.route.status,
          arrival: l.earliestArrival,
          calculatedAt: l.route.calculatedAt,
          conflict: l.conflict,
        }));
      return result;
    }),
    cleaners: cleaners.map((c) => ({
      id: c.id,
      name: c.name,
      active: c.active,
    })),
    cleanerId: input.cleanerId ?? "",
    travelBuffer: settings.defaultTravelBufferMinutes,
    truncated: rows.length > 1000 || crew.length > 200,
  };
}
export async function getOrderPlanning(id: string) {
  await requireAdmin();
  if (!entityId.safeParse(id).success) notFound();
  const db = getDatabase(),
    order = await db.order.findUnique({
      where: { id },
      include: calendarSelect,
    });
  if (!order) notFound();
  const cleaners = await db.cleaner.findMany({
    where: {
      OR: [
        { active: true },
        { assignments: { some: { orderId: id, removedAt: null } } },
      ],
    },
    select: { id: true, name: true, active: true },
    orderBy: { name: "asc" },
    take: 200,
  });
  const overrides = await db.schedulingOverride.findMany({
    where: { orderId: id },
    take: 10,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      reason: true,
      createdAt: true,
      user: { select: { name: true } },
    },
  });
  return {
    order: dto(order, await assessScheduling(db, planning(order), true)),
    cleaners,
    overrides,
  };
}
export async function listCleaners(
  query: { q?: string; active?: string; page?: string } = {},
) {
  await requireAdmin();
  const db = getDatabase(),
    page = Math.max(
      1,
      Math.min(100000, Number.parseInt(query.page ?? "1") || 1),
    ),
    q = (query.q ?? "").slice(0, 100);
  const today = Temporal.Now.plainDateISO('Europe/Belgrade').toString();
  const where: Prisma.CleanerWhereInput = {
    ...(query.active === "yes"
      ? { active: true }
      : query.active === "no"
        ? { active: false }
        : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };
  const [count, rows, settings] = await Promise.all([
    db.cleaner.count({ where }),
    db.cleaner.findMany({
      where,
      skip: (page - 1) * 20,
      take: 20,
      orderBy: [{ active: "desc" }, { name: "asc" }, { id: "asc" }],
      select: {
        id: true,
        name: true,
        phone: true,
        active: true,
        homeAddress:true,homeLatitude:true,homeLongitude:true,homeCoordinatesConfirmed:true,availability:{where:{OR:[{kind:'WEEKLY'},{date:new Date(today)}]},select:{kind:true,startMinute:true,endMinute:true,weekday:true,date:true}},
        assignments:{where:{removedAt:null,order:{scheduledStart:{gte:new Date()},status:{notIn:['COMPLETED','CANCELLED','NO_SHOW']}}},orderBy:{order:{scheduledStart:'asc'}},take:1,select:{order:{select:{id:true,scheduledStart:true,client:{select:{name:true}}}}}},
        defaultTravelMode: true,
        languages: true,
        payoutPercent: true,
      },
    }),
    db.businessSettings.findUniqueOrThrow({where:{id:'default'},select:{defaultCleanerPayoutPercent:true}}),
  ]);
  return { count, rows, page, size: 20, defaultPercent:settings.defaultCleanerPayoutPercent };
}
export async function getCleaner(id: string) {
  await requireAdmin();
  if (!entityId.safeParse(id).success) notFound();
  const db = getDatabase(),
    cleaner = await db.cleaner.findUnique({
      where: { id },
      include: {
        availability: {
          orderBy: [{ date: "desc" }, { weekday: "asc" }],
          take: 157,
        },
      },
    });
  if (!cleaner) notFound();
  return cleaner;
}
