import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { CrmError, localInstant } from "@/lib/domain/crm";
import {
  calendarRange,
  plainDate,
  SchedulingConflictService,
} from "@/lib/domain/scheduling-conflicts";
import { SchedulingError } from "@/lib/domain/scheduling-types";
import { ROUTING_CONFIG, routeUsable, geo } from "@/lib/domain/routing";
import {
  AvailabilityService,
  ScheduleOptimizer,
  assessTravel,
  routeIssues,
  preparationRequests,
  travelRequests,
  type RoutingSnapshot,
  type RoutingOrder,
} from "@/lib/domain/logistics";
import { RoutingService } from "./route-cache";
import { verifyLocation } from "./google-places";
import { lockCrew } from "./scheduling-commands";
import { writeAudit } from "./audit";
import { routingSchemas } from "@/lib/validation/routing";
export type RoutingDb = Prisma.TransactionClient;
export async function routingSnapshot(
  db: RoutingDb,
  date: string,
): Promise<RoutingSnapshot> {
  const range = calendarRange("day", date),
    from = new Date(range.from.getTime() - 86400000),
    to = new Date(range.to.getTime() + 86400000);
  const rows = await db.order.findMany({
    where: {
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      OR: [
        { scheduledStart: { gte: from, lt: to } },
        {
          scheduledStart: null,
          scheduleMode: "FLEXIBLE",
          windowFrom: { lt: range.to },
          windowTo: { gt: range.from },
        },
      ],
    },
    include: {
      address: true,
      assignments: {
        where: { removedAt: null },
        select: { cleanerId: true },
      },
    },
    orderBy: { id: "asc" },
    take: ROUTING_CONFIG.maxOrders + 1,
  });
  const cleaners = await db.cleaner.findMany({
    where: {
      OR: [
        { active: true },
        {
          assignments: {
            some: {
              removedAt: null,
              order: { scheduledStart: { gte: from, lt: to } },
            },
          },
        },
      ],
    },
    include: {
      availability: {
        where: { OR: [{ kind: "WEEKLY" }, { date: { gte: from, lte: to } }] },
        orderBy: { id: "asc" },
      },
    },
    orderBy: { id: "asc" },
    take: ROUTING_CONFIG.maxCleaners + 1,
  });
  const settings = await db.businessSettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  if (
    rows.length > ROUTING_CONFIG.maxOrders ||
    cleaners.length > ROUTING_CONFIG.maxCleaners
  )
    throw new CrmError(
      "VALIDATION",
      "Для логистики выберите день с максимум 100 заказами и 20 клинерами.",
    );
  const snapshot = {
    date,
    defaultBuffer: settings.defaultTravelBufferMinutes,
    orders: rows.map((r) => ({
      ...r,
      point: geo(r.address.latitude, r.address.longitude, r.address.placeId),
      label: r.address.fullAddress,
      reference: r.reference ?? r.id,
      updatedAt: r.updatedAt.toISOString(),
      cleanerIds: r.assignments.map((a) => a.cleanerId).sort(),
    })),
    cleaners: cleaners.map((c) => ({
      ...c,
      home: geo(c.homeLatitude, c.homeLongitude, c.homePlaceId),
      updatedAt: c.updatedAt.toISOString(),
    })),
    version: "",
  };
  // Includes hours, date exceptions, coordinates, assignments and settings, not only order.updatedAt.
  snapshot.version = createHash("sha256")
    .update(JSON.stringify(snapshot))
    .digest("hex");
  return snapshot;
}
export async function dayLogistics(
  db: RoutingDb,
  date: string,
  cleanerId?: string,
) {
  const snapshot = await routingSnapshot(db, date),
    legs = travelRequests(
      snapshot,
      snapshot.orders,
      cleanerId ? [cleanerId] : undefined,
    ),
    service = new RoutingService(db),
    table = await service.prepare(legs.map((l) => l.request));
  const travel = assessTravel(
    snapshot,
    table,
    snapshot.orders,
    cleanerId ? [cleanerId] : undefined,
  );
  return {
    date,
    available: Boolean(process.env.GOOGLE_MAPS_SERVER_API_KEY),
    legs: travel,
    issues: routeIssues(travel),
    points: [
      ...snapshot.cleaners
        .filter((c) => !cleanerId || c.id === cleanerId)
        .filter((c) => c.home)
        .map((c) => ({
          id: c.id,
          label: "Старт · " + c.name,
          point: c.home!,
          kind: "home",
        })),
      ...snapshot.orders
        .filter(
          (o) =>
            o.scheduledStart &&
            plainDate(o.scheduledStart).toString() === date &&
            (!cleanerId || o.cleanerIds.includes(cleanerId)),
        )
        .sort(
          (a, b) => a.scheduledStart!.getTime() - b.scheduledStart!.getTime(),
        )
        .filter((o) => o.point)
        .map((o, i) => ({
          id: o.id,
          label: `${i + 1} · ${o.reference} · ${o.label}`,
          point: o.point!,
          kind: "order",
        })),
    ],
    version: snapshot.version,
  };
}
export async function findSlots(db: RoutingDb, payload: unknown) {
  const input = routingSchemas.slots.parse(payload),
    snapshot = await routingSnapshot(db, input.date),
    stored = input.orderId
      ? await db.order.findUnique({
          where: { id: input.orderId },
          include: { address: true },
        })
      : null;
  if (input.orderId && !stored)
    throw new CrmError("NOT_FOUND", "Заказ не найден");
  if (
    stored &&
    ["COMPLETED", "CANCELLED", "NO_SHOW", "EN_ROUTE", "IN_PROGRESS"].includes(
      stored.status,
    )
  )
    throw new CrmError(
      "VALIDATION",
      "Заказ недоступен для поиска нового времени.",
    );
  const address =
      stored?.address ??
      (input.addressId
        ? await db.clientAddress.findUnique({ where: { id: input.addressId } })
        : null),
    selected = input.locationProof ? verifyLocation(input.locationProof) : null;
  const from = localInstant(input.from),
    to = localInstant(input.to);
  if (
    from >= to ||
    plainDate(from).toString() !== input.date ||
    to.getTime() - from.getTime() > 86400000
  )
    throw new CrmError(
      "VALIDATION",
      "Укажите окно выбранного дня, не более суток.",
    );
  const order: RoutingOrder = {
    ...(stored ?? {}),
    id: stored?.id ?? "new-order",
    addressId: address?.id ?? "new-address",
    status: stored?.status ?? "DRAFT",
    scheduleMode: stored?.scheduleMode ?? "FLEXIBLE",
    scheduledStart: stored?.scheduledStart ?? null,
    windowFrom: stored?.scheduleMode === "FLEXIBLE" ? stored.windowFrom : from,
    windowTo: stored?.scheduleMode === "FLEXIBLE" ? stored.windowTo : to,
    manualDurationMinutes: input.duration,
    estimatedDurationMinutes: null,
    requiredCleaners: input.requiredCleaners,
    travelBufferMinutes: stored?.travelBufferMinutes ?? snapshot.defaultBuffer,
    cleaningReserveMinutes: stored?.cleaningReserveMinutes ?? 0,
    cleanerIds:
      snapshot.orders.find((o) => o.id === stored?.id)?.cleanerIds ?? [],
    point: address
      ? geo(address.latitude, address.longitude, address.placeId)
      : selected
        ? geo(selected.latitude, selected.longitude, selected.placeId)
        : null,
    label: address?.fullAddress ?? selected?.address ?? "Адрес не определён",
    reference: stored?.reference ?? "Новый заказ",
    updatedAt: stored?.updatedAt.toISOString() ?? "",
  };
  // A fixed agreement keeps its time. An unconfirmed draft can search a new fixed time without changing it yet.
  const searching =
    stored?.scheduleMode === "FIXED" && stored.status !== "DRAFT"
      ? order
      : {
          ...order,
          scheduleMode: "FLEXIBLE" as const,
          windowFrom:
            stored?.scheduleMode === "FLEXIBLE"
              ? new Date(Math.max(from.getTime(), stored.windowFrom!.getTime()))
              : from,
          windowTo:
            stored?.scheduleMode === "FLEXIBLE"
              ? new Date(Math.min(to.getTime(), stored.windowTo!.getTime()))
              : to,
        };
  const table = await new RoutingService(db).prepare(
      preparationRequests(snapshot, [searching]),
    ),
    slots = AvailabilityService.findAvailableSlots(searching, snapshot, table);
  return {
    slots,
    orderId: stored?.id,
    updatedAt: stored?.updatedAt.toISOString(),
    manualDuration: input.duration,
    message: slots.length
      ? "Показаны проверенные варианты внутри окна; поиск ограничен по расходам Google."
      : "Проверенных вариантов нет. Нужны координаты, маршруты, рабочие часы и полная команда. Ручное планирование доступно.",
  };
}
export async function proposeDay(db: RoutingDb, userId: string, date: string) {
  const snapshot = await routingSnapshot(db, date),
    targets = snapshot.orders.filter(
      (o) =>
        plainDate(o.scheduledStart ?? o.windowFrom!).toString() === date &&
        ![
          "COMPLETED",
          "CANCELLED",
          "NO_SHOW",
          "EN_ROUTE",
          "IN_PROGRESS",
        ].includes(o.status),
    ),
    service = new RoutingService(db),
    table = await service.prepare(preparationRequests(snapshot, targets));
  const result = ScheduleOptimizer.propose(snapshot, table);
  const changes = result.orders
    .filter((o) => {
      const old = snapshot.orders.find((r) => r.id === o.id);
      return (
        old &&
        (old.scheduledStart?.toISOString() !==
          o.scheduledStart?.toISOString() ||
          old.cleanerIds.join() !== o.cleanerIds.join())
      );
    })
    .map((o) => ({
      id: o.id,
      reference: o.reference,
      start: o.scheduledStart?.toISOString() ?? null,
      previousStart:
        snapshot.orders
          .find((r) => r.id === o.id)!
          .scheduledStart?.toISOString() ?? null,
      cleanerIds: o.cleanerIds,
      cleaners: o.cleanerIds.map(
        (id) => snapshot.cleaners.find((c) => c.id === id)!.name,
      ),
    }));
  if (!result.feasible || !changes.length)
    return {
      ...result,
      orders: undefined,
      changes,
      proposalId: null,
      message: result.feasible
        ? !targets.length
          ? "На выбранный день нет заказов для оптимизации."
          : result.unplaced.length
            ? "Подходящих проверенных вариантов для оставшихся заказов нет; изменений нет."
            : "Проверенный план уже сохранён; изменений нет."
        : "Рекомендацию нельзя применить без проверенной логистики и полной команды.",
    };
  const proposal = await db.schedulingProposal.create({
    data: {
      userId,
      date,
      version: snapshot.version,
      plan: changes as unknown as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + ROUTING_CONFIG.proposalSeconds * 1000),
    },
  });
  return {
    ...result,
    orders: undefined,
    changes,
    proposalId: proposal.id,
    message:
      "Предложение не меняет календарь. Проверьте изменения перед применением.",
  };
}
export async function applyProposal(
  db: import("@/generated/prisma/client").PrismaClient,
  userId: string,
  proposalId: string,
) {
  const stored = await db.schedulingProposal.findFirst({
    where: { id: proposalId, userId },
  });
  if (!stored || stored.appliedAt || stored.expiresAt < new Date())
    throw new CrmError(
      "STALE",
      "Предложение истекло или уже применено. Пересчитайте день.",
    );
  const snapshot = await routingSnapshot(db, stored.date);
  if (snapshot.version !== stored.version)
    throw new CrmError(
      "STALE",
      "Расписание изменилось. Пересчитайте предложение.",
    );
  const changes = stored.plan as unknown as {
    id: string;
    start: string | null;
    cleanerIds: string[];
  }[];
  const proposed = snapshot.orders.map((o) => {
    const change = changes.find((c) => c.id === o.id);
    return change
      ? {
          ...o,
          scheduledStart: change.start ? new Date(change.start) : null,
          cleanerIds: change.cleanerIds,
        }
      : o;
  });
  const table = await new RoutingService(db).prepare(
    travelRequests(snapshot, proposed).map((l) => l.request),
  );
  return db.$transaction(
    async (tx) => {
      if (
        !(await tx.user.count({
          where: { id: userId, role: "ADMIN", active: true },
        }))
      )
        throw new CrmError("FORBIDDEN", "Недостаточно прав");
      await tx.$queryRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))::text",
        "proposal:" + proposalId,
      );
      for (const id of snapshot.orders.map((o) => o.id).sort())
        await tx.$queryRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1))::text",
          "order:" + id,
        );
      await lockCrew(
        tx,
        snapshot.cleaners.map((c) => c.id),
      );
      const current = await routingSnapshot(tx, stored.date),
        record = await tx.schedulingProposal.findUniqueOrThrow({
          where: { id: proposalId },
        });
      if (
        current.version !== stored.version ||
        record.appliedAt ||
        record.expiresAt < new Date()
      )
        throw new CrmError(
          "STALE",
          "Расписание изменилось. Пересчитайте предложение.",
        );
      for (const candidate of proposed.filter((o) =>
        changes.some((c) => c.id === o.id),
      )) {
        const old = current.orders.find((o) => o.id === candidate.id)!;
        if (
          old.scheduleMode === "FIXED" &&
          old.scheduledStart?.toISOString() !==
            candidate.scheduledStart?.toISOString()
        )
          throw new CrmError(
            "VALIDATION",
            "Фиксированное время менять нельзя.",
          );
        if (
          candidate.cleanerIds.length < candidate.requiredCleaners ||
          candidate.cleanerIds.some(
            (id) => !current.cleaners.some((c) => c.id === id && c.active),
          )
        )
          throw new CrmError(
            "VALIDATION",
            "Команда изменилась. Пересчитайте день.",
          );
        const issues = SchedulingConflictService.check(
          candidate,
          current.cleaners,
          proposed,
          current.defaultBuffer,
        ).filter((i) => i.code !== "OPERATING_GAP");
        if (issues.length) throw new SchedulingError(issues);
      }
      const legs = assessTravel(current, table, proposed);
      if (legs.some((l) => !routeUsable(l.route) || l.conflict))
        throw new SchedulingError(routeIssues(legs));
      for (const change of changes) {
        const before = current.orders.find((o) => o.id === change.id)!;
        await tx.order.update({
          where: { id: change.id },
          data: {
            scheduledStart: change.start ? new Date(change.start) : null,
            updatedAt: new Date(),
          },
        });
        await tx.orderCleaner.updateMany({
          where: {
            orderId: change.id,
            removedAt: null,
            cleanerId: { notIn: change.cleanerIds },
          },
          data: { removedAt: new Date() },
        });
        for (const id of change.cleanerIds)
          await tx.orderCleaner.upsert({
            where: { orderId_cleanerId: { orderId: change.id, cleanerId: id } },
            create: { orderId: change.id, cleanerId: id },
            update: { removedAt: null },
          });
        await writeAudit(
          tx,
          { type: "USER", userId },
          {
            action: "OPTIMIZATION_APPLIED",
            entityType: "Order",
            entityId: change.id,
            changes: {
              scheduledStart: {
                before: before.scheduledStart?.toISOString() ?? null,
                after: change.start,
              },
              cleanerIds: {
                before: before.cleanerIds,
                after: change.cleanerIds,
              },
            },
          },
        );
      }
      await tx.schedulingProposal.update({
        where: { id: proposalId },
        data: { appliedAt: new Date() },
      });
      return { applied: changes.length };
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
export async function routeDetails(db: RoutingDb, payload: unknown) {
  const input = routingSchemas.details.parse(payload),
    snapshot = await routingSnapshot(db, input.date),
    leg = travelRequests(snapshot).find(
      (l) => l.orderId === input.orderId && l.cleanerId === input.cleanerId,
    );
  if (!leg) throw new CrmError("NOT_FOUND", "Переход не найден");
  const request = {
    ...leg.request,
    mode: input.taxi ? ("DRIVE" as const) : ("TRANSIT" as const),
  };
  if (input.taxi && request.timing === "arrival") {
    request.timing = "departure";
    request.at = new Date(
      Math.max(Date.now(), new Date(request.at).getTime()),
    ).toISOString();
  }
  const details = await new RoutingService(db).getRouteDetails(request);
  return {
    ...details,
    origin: leg.origin,
    destination: leg.destination,
    taxi: input.taxi,
    notice: input.taxi
      ? "Такси — оценка дороги автомобилем без ожидания подачи. Назначения не изменены."
      : "Google: общественный транспорт и пешие участки.",
  };
}
