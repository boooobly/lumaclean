import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import {
  schedulingSchemas,
  type SchedulingCommand,
} from "@/lib/validation/scheduling";
import { CrmError, assertTransition, localInstant } from "@/lib/domain/crm";
import { SchedulingError, closedStatuses } from "@/lib/domain/scheduling-types";
import {
  SchedulingConflictService,
  plannedEnd,
  type PlanningOrder,
} from "@/lib/domain/scheduling-conflicts";
import { writeAudit, type AuditChanges } from "./audit";
import { normalizeHome } from "./google-places";
import { RoutingService } from "./route-cache";
import {
  assessTravel,
  routeIssues,
  travelRequests,
  type RoutingSnapshot,
  type RoutingOrder,
} from "@/lib/domain/logistics";
import { plainDate } from "@/lib/domain/scheduling-conflicts";
import { geo } from "@/lib/domain/routing";
type Tx = Prisma.TransactionClient;
export async function schedulingLock(tx: Tx, kind: string, id: string) {
  await tx.$queryRawUnsafe(
    "SELECT pg_advisory_xact_lock(hashtext($1))::text",
    "scheduling:" + kind + ":" + id,
  );
}
export async function lockCrew(tx: Tx, ids: string[]) {
  for (const id of [...new Set(ids)].sort())
    await schedulingLock(tx, "cleaner", id);
}
export async function assessScheduling(
  tx: Tx,
  order: PlanningOrder,
  cacheOnly = false,
) {
  const start = order.scheduledStart ?? order.windowFrom ?? new Date(),
    end = plannedEnd(order) ?? start;
  const cleaners = await tx.cleaner.findMany({
    where: { id: { in: order.cleanerIds } },
    include: {
      availability: {
        where: {
          OR: [
            { kind: "WEEKLY" },
            {
              date: {
                gte: new Date(start.getTime() - 86400000),
                lte: new Date(end.getTime() + 86400000),
              },
            },
          ],
        },
      },
    },
  });
  let others: RoutingOrder[] = [];
  if (order.scheduledStart && order.cleanerIds.length) {
    const from = new Date(order.scheduledStart.getTime() - 86400000),
      to = new Date(
        (plannedEnd(order) ?? order.scheduledStart).getTime() + 86400000,
      );
    const rows = await tx.order.findMany({
      where: {
        id: { not: order.id },
        status: { notIn: ["CANCELLED", "NO_SHOW"] },
        scheduledStart: { lt: to },
        OR: [
          { scheduledEnd: { gt: from } },
          { scheduledEnd: null, scheduledStart: { gte: from } },
        ],
        assignments: {
          some: { removedAt: null, cleanerId: { in: order.cleanerIds } },
        },
      },
      include: {
        address: true,
        assignments: {
          where: { removedAt: null },
          select: { cleanerId: true },
        },
      },
      take: 1001,
    });
    if (rows.length > 1000)
      throw new CrmError(
        "VALIDATION",
        "Слишком много связанных заказов для безопасной проверки.",
      );
    others = rows.map((r) => ({
      ...r,
      updatedAt: r.updatedAt.toISOString(),
      point: geo(r.address.latitude, r.address.longitude, r.address.placeId),
      label: r.address.fullAddress,
      reference: r.reference ?? r.id,
      cleanerIds: r.assignments.map((a) => a.cleanerId),
    }));
  }
  const settings = await tx.businessSettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  const issues = SchedulingConflictService.check(
    order,
    cleaners,
    others,
    settings.defaultTravelBufferMinutes,
  );
  if (
    !order.scheduledStart ||
    !order.cleanerIds.length ||
    closedStatuses.includes(order.status)
  )
    return issues;
  const address = order.addressId
    ? await tx.clientAddress.findUnique({ where: { id: order.addressId } })
    : null;
  const candidate: RoutingOrder = {
    ...order,
    addressId: order.addressId ?? "",
    updatedAt: "",
    reference: order.id,
    label: address?.fullAddress ?? "Адрес не определён",
    point: address
      ? geo(address.latitude, address.longitude, address.placeId)
      : null,
  };
  const snapshot: RoutingSnapshot = {
    date: plainDate(order.scheduledStart).toString(),
    version: "",
    defaultBuffer: settings.defaultTravelBufferMinutes,
    orders: [...others, candidate],
    cleaners: cleaners.map((c) => ({
      ...c,
      name: c.name,
      updatedAt: c.updatedAt.toISOString(),
      home: geo(c.homeLatitude, c.homeLongitude, c.homePlaceId),
    })),
  };
  const requests = travelRequests(snapshot);
  const table = await new RoutingService(tx).prepare(
    requests.map((r) => r.request),
    cacheOnly,
  );
  // Validate both incoming and outgoing journeys of every participant.
  const legs = assessTravel(snapshot, table).filter(
    (l) => l.orderId === order.id || l.previousId === order.id,
  );
  return [
    ...issues.filter(
      (i) =>
        i.code !== "OPERATING_GAP" ||
        !legs.some(
          (l) =>
            l.cleanerId === i.cleanerId &&
            l.route.status === "VERIFIED" &&
            (l.previousId === i.orderId || l.orderId === i.orderId),
        ),
    ),
    ...routeIssues(legs),
  ];
}
export async function enforceScheduling(
  tx: Tx,
  order: PlanningOrder,
  userId: string,
  confirmation: {
    acknowledged?: string[];
    overrideReason?: string | null;
  } = {},
) {
  const issues = await assessScheduling(tx, order);
  if (
    issues.some((i) => i.severity === "ERROR") ||
    issues.some((i) => !confirmation.acknowledged?.includes(i.key)) ||
    (issues.length && !confirmation.overrideReason?.trim())
  )
    throw new SchedulingError(issues);
  if (issues.length) {
    if (confirmation.overrideReason!.trim().length < 5)
      throw new CrmError(
        "VALIDATION",
        "Объясните подтверждение: не менее 5 символов.",
      );
    await tx.schedulingOverride.create({
      data: {
        orderId: order.id,
        userId,
        issueKeys: issues.map((i) => i.key),
        reason: confirmation.overrideReason!.trim(),
      },
    });
    await writeAudit(
      tx,
      { type: "USER", userId },
      {
        action: "SCHEDULING_OVERRIDE",
        entityType: "Order",
        entityId: order.id,
        changes: {
          overrideCodes: { before: null, after: issues.map((i) => i.code) },
        },
      },
    );
  }
  return issues;
}
export async function runSchedulingCommand(
  db: PrismaClient,
  userId: string,
  command: SchedulingCommand,
  payload: unknown,
) {
  schedulingSchemas[command].parse(payload);
  return db.$transaction(
    async (tx) => {
      if (
        !(await tx.user.count({
          where: { id: userId, role: "ADMIN", active: true },
        }))
      )
        throw new CrmError("FORBIDDEN", "Недостаточно прав");
      const audit = (
        action: string,
        type: string,
        id: string,
        changes?: AuditChanges,
      ) =>
        writeAudit(
          tx,
          { type: "USER", userId },
          { action, entityType: type, entityId: id, changes },
        );
      if (command === "cleaner-create") {
        const { cleaner } = schedulingSchemas[command].parse(payload);
        const created = await tx.cleaner.create({
          data: normalizeHome(cleaner),
        });
        await audit("CLEANER_CREATED", "Cleaner", created.id);
        return { id: created.id };
      }
      if (command === "order-plan") {
        const input = schedulingSchemas[command].parse(payload);
        await tx.$queryRawUnsafe(
          "SELECT pg_advisory_xact_lock(hashtext($1))::text",
          "order:" + input.id,
        );
        const stored = await tx.order.findUnique({ where: { id: input.id } });
        if (!stored) throw new CrmError("NOT_FOUND", "Заказ не найден");
        if (closedStatuses.includes(stored.status))
          throw new CrmError(
            "TRANSITION",
            "Закрытый заказ доступен только для просмотра",
          );
        if (stored.updatedAt.toISOString() !== input.expectedUpdatedAt)
          throw new CrmError(
            "STALE",
            "Заказ изменился. Обновите страницу и проверьте условия.",
          );
        const previous = await tx.orderCleaner.findMany({
          where: { orderId: stored.id, removedAt: null },
        });
        const oldIds = previous.map((a) => a.cleanerId);
        await lockCrew(tx, [...oldIds, ...input.cleanerIds]);
        const active = await tx.cleaner.findMany({
          where: { id: { in: input.cleanerIds } },
          select: { id: true, active: true },
        });
        if (
          input.cleanerIds.some(
            (id) =>
              !active.some(
                (c) => c.id === id && (c.active || oldIds.includes(id)),
              ),
          )
        )
          throw new CrmError(
            "VALIDATION",
            "Для нового назначения выберите активного клинера.",
          );
        if (stored.scheduleMode === "FIXED" && !input.scheduledStart)
          throw new CrmError(
            "VALIDATION",
            "Для фиксированного заказа задайте время.",
          );
        if (input.status && input.status !== stored.status) {
          assertTransition("Order", stored.status, input.status);
          if (["CANCELLED", "NO_SHOW"].includes(input.status))
            throw new CrmError(
              "VALIDATION",
              "Отмена и неявка оформляются в карточке заказа с причиной.",
            );
          if (input.status === "COMPLETED" && stored.finalPrice === null)
            throw new CrmError(
              "VALIDATION",
              "Перед завершением укажите финальную цену.",
            );
        }
        const proposed: PlanningOrder = {
          ...stored,
          scheduledStart: input.scheduledStart
            ? localInstant(input.scheduledStart)
            : null,
          manualDurationMinutes: input.manualDurationMinutes,
          requiredCleaners: input.requiredCleaners ?? stored.requiredCleaners,
          cleanerIds: input.cleanerIds,
          status: input.status ?? stored.status,
        };
        const changes: AuditChanges = {};
        if (stored.requiredCleaners !== proposed.requiredCleaners)
          changes.requiredCleaners = {
            before: String(stored.requiredCleaners),
            after: String(proposed.requiredCleaners),
          };
        if (
          stored.scheduledStart?.toISOString() !==
          proposed.scheduledStart?.toISOString()
        )
          changes.scheduledStart = {
            before: stored.scheduledStart?.toISOString() ?? null,
            after: proposed.scheduledStart?.toISOString() ?? null,
          };
        if (stored.manualDurationMinutes !== proposed.manualDurationMinutes)
          changes.manualDurationMinutes = {
            before: stored.manualDurationMinutes?.toString() ?? null,
            after: proposed.manualDurationMinutes?.toString() ?? null,
          };
        if ([...oldIds].sort().join() !== [...input.cleanerIds].sort().join())
          changes.cleanerIds = { before: oldIds, after: input.cleanerIds };
        if (stored.status !== proposed.status)
          changes.status = { before: stored.status, after: proposed.status };
        if (!Object.keys(changes).length) return { id: stored.id };
        await enforceScheduling(
          tx,
          { ...proposed, status: stored.status },
          userId,
          input,
        );
        await tx.order.update({
          where: { id: stored.id },
          data: {
            scheduledStart: proposed.scheduledStart,
            manualDurationMinutes: proposed.manualDurationMinutes,
            requiredCleaners: proposed.requiredCleaners,
            status: input.status,
            ...(input.status === "COMPLETED"
              ? { completedAt: new Date() }
              : {}),
            updatedAt: new Date(),
          },
        });
        for (const id of oldIds.filter(
          (id) => !input.cleanerIds.includes(id),
        )) {
          await tx.orderCleaner.update({
            where: { orderId_cleanerId: { orderId: stored.id, cleanerId: id } },
            data: { removedAt: new Date() },
          });
          await audit("CLEANER_UNASSIGNED", "Order", stored.id, {
            cleanerIds: { before: [id], after: [] },
          });
        }
        for (const id of input.cleanerIds.filter(
          (id) => !oldIds.includes(id),
        )) {
          await tx.orderCleaner.upsert({
            where: { orderId_cleanerId: { orderId: stored.id, cleanerId: id } },
            create: { orderId: stored.id, cleanerId: id },
            update: { removedAt: null },
          });
          await audit("CLEANER_ASSIGNED", "Order", stored.id, {
            cleanerIds: { before: [], after: [id] },
          });
        }
        if (changes.scheduledStart)
          await audit(
            proposed.scheduledStart === null
              ? "ORDER_UNPLACED"
              : input.source === "CALENDAR_DRAG"
                ? "ORDER_DRAGGED"
                : "ORDER_RESCHEDULED",
            "Order",
            stored.id,
            { scheduledStart: changes.scheduledStart },
          );
        if (changes.manualDurationMinutes)
          await audit("ORDER_DURATION_CHANGED", "Order", stored.id, {
            manualDurationMinutes: changes.manualDurationMinutes,
          });
        if (changes.requiredCleaners)
          await audit("ORDER_UPDATED", "Order", stored.id, {
            requiredCleaners: changes.requiredCleaners,
          });
        if (changes.status)
          await audit(
            input.status === "COMPLETED"
              ? "ORDER_COMPLETED"
              : "ORDER_STATUS_CHANGED",
            "Order",
            stored.id,
            { status: changes.status },
          );
        return { id: stored.id };
      }
      const parsed = schedulingSchemas[command].parse(payload) as {
        id: string;
      };
      await schedulingLock(tx, "cleaner", parsed.id);
      if (!(await tx.cleaner.count({ where: { id: parsed.id } })))
        throw new CrmError("NOT_FOUND", "Клинер не найден");
      if (command === "cleaner-update") {
        const { cleaner: inputCleaner } =
          schedulingSchemas[command].parse(payload);
        const current = await tx.cleaner.findUniqueOrThrow({
          where: { id: parsed.id },
        });
        const cleaner = normalizeHome(inputCleaner, current);
        const fields = Object.keys(cleaner).filter(
          (key) =>
            JSON.stringify(
              key === "internalRating" ||
                key === "payoutPercent" ||
                key === "homeLatitude" ||
                key === "homeLongitude"
                ? current[key] === null
                  ? null
                  : Number(current[key])
                : current[key as keyof typeof current],
            ) !== JSON.stringify(cleaner[key as keyof typeof cleaner]),
        );
        if (fields.length) {
          await tx.cleaner.update({ where: { id: parsed.id }, data: cleaner });
          await audit("CLEANER_UPDATED", "Cleaner", parsed.id, {
            changedFields: { before: null, after: fields },
          });
        }
      } else if (command === "cleaner-active") {
        const { active } = schedulingSchemas[command].parse(payload);
        const current = await tx.cleaner.findUniqueOrThrow({
          where: { id: parsed.id },
        });
        if (current.active !== active) {
          await tx.cleaner.update({
            where: { id: parsed.id },
            data: { active },
          });
          await audit("CLEANER_ACTIVITY_CHANGED", "Cleaner", parsed.id, {
            active: { before: current.active, after: active },
          });
        }
      } else if (command === "availability-week") {
        const { week } = schedulingSchemas[command].parse(payload);
        const selected = {
          weekday: true,
          startMinute: true,
          endMinute: true,
        } as const;
        const before = await tx.cleanerAvailability.findMany({
          where: { cleanerId: parsed.id, kind: "WEEKLY" },
          select: selected,
          orderBy: { weekday: "asc" },
        });
        const next = [...week]
          .sort((a, b) => a.weekday - b.weekday)
          .map((r) => ({
            weekday: r.weekday,
            startMinute: r.startMinute,
            endMinute: r.endMinute,
          }));
        if (JSON.stringify(before) === JSON.stringify(next))
          return { id: parsed.id };
        await tx.cleanerAvailability.deleteMany({
          where: { cleanerId: parsed.id, kind: "WEEKLY" },
        });
        await tx.cleanerAvailability.createMany({
          data: week.map((r) => ({
            weekday: r.weekday,
            startMinute: r.startMinute,
            endMinute: r.endMinute,
            cleanerId: parsed.id,
            kind: "WEEKLY" as const,
          })),
        });
        await audit("AVAILABILITY_WEEK_UPDATED", "Cleaner", parsed.id, {
          changedFields: { before: null, after: ["weeklyHours"] },
        });
      } else if (command === "availability-date") {
        const { date, kind, startMinute, endMinute, reason } =
            schedulingSchemas[command].parse(payload),
          day = new Date(date + "T00:00:00Z");
        await tx.cleanerAvailability.deleteMany({
          where: { cleanerId: parsed.id, date: day },
        });
        await tx.cleanerAvailability.create({
          data: {
            cleanerId: parsed.id,
            date: day,
            kind,
            startMinute,
            endMinute,
            reason,
          },
        });
        await audit("AVAILABILITY_EXCEPTION_UPDATED", "Cleaner", parsed.id, {
          date: { before: null, after: date },
        });
      } else if (command === "availability-remove") {
        const { date } = schedulingSchemas[command].parse(payload);
        const deleted = await tx.cleanerAvailability.deleteMany({
          where: { cleanerId: parsed.id, date: new Date(date + "T00:00:00Z") },
        });
        if (deleted.count)
          await audit("AVAILABILITY_EXCEPTION_REMOVED", "Cleaner", parsed.id, {
            date: { before: date, after: null },
          });
      }
      return { id: parsed.id };
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
