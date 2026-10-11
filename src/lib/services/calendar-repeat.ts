import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  repeatInput,
  repeatDates,
  type RepeatInput,
} from "@/lib/domain/calendar-repeat";
import { CrmError, localInstant, localInput } from "@/lib/domain/crm";
import { quote, priceSnapshot, type ExtraCode } from "@/lib/domain/crm-pricing";
import type { ServiceId } from "@/lib/pricing";
import {
  SchedulingError,
  closedStatuses,
  type SchedulingIssue,
} from "@/lib/domain/scheduling-types";
import {
  SchedulingConflictService,
  type PlanningOrder,
} from "@/lib/domain/scheduling-conflicts";
import {
  assessScheduling,
  lockCrew,
  schedulingLock,
} from "./scheduling-commands";
import { writeAudit } from "./audit";
import { z } from "zod";
type Tx = Prisma.TransactionClient;
const include = {
  extras: { include: { extra: true } },
  assignments: { where: { removedAt: null } },
  client: true,
  address: true,
  service: true,
} as const;
type Source = Prisma.OrderGetPayload<{ include: typeof include }>;
// Explicit allowlist: no historical lifecycle, payments, incidents, routes or AI data.
export function copyTemplate(source: Source) {
  return {
    clientId: source.clientId,
    addressId: source.addressId,
    serviceId: source.serviceId!,
    area: Number(source.area),
    soilLevel: source.soilLevel,
    urgent: source.urgent,
    requiredCleaners: source.requiredCleaners,
    manualDurationMinutes: source.manualDurationMinutes,
    estimatedDurationMinutes: source.estimatedDurationMinutes,
    durationOverrideReason: source.durationOverrideReason,
    durationSnapshot: source.durationSnapshot ?? Prisma.JsonNull,
    durationRuleVersion: source.durationRuleVersion,
    durationRuleId: source.durationRuleId,
    cleaningReserveMinutes: source.cleaningReserveMinutes,
    travelBufferMinutes: source.travelBufferMinutes,
    basePrice: source.basePrice === null ? null : Number(source.basePrice),
    discountPercent: Number(source.discountPercent),
    discountAmount: Number(source.discountAmount),
    finalPrice: source.finalPrice === null ? null : Number(source.finalPrice),
    priceAdjustment:
      source.priceAdjustment === null ? null : Number(source.priceAdjustment),
    priceChangeReason: source.priceChangeReason,
    currency: source.currency,
    // Comments may contain incidents; only the new explicit comment is used.
  };
}
async function sourceFor(tx: Tx, input: RepeatInput) {
  const source = await tx.order.findUnique({
    where: { id: input.sourceId },
    include,
  });
  if (!source) throw new CrmError("NOT_FOUND", "Исходная уборка не найдена.");
  if (source.historical || !source.service?.active)
    throw new CrmError(
      "VALIDATION",
      "Историческую или отключённую услугу нельзя повторить.",
    );
  if (source.updatedAt.toISOString() !== input.expectedUpdatedAt)
    throw new CrmError(
      "STALE",
      "Исходный заказ изменился. Откройте его заново.",
    );
  return source;
}
function dates(input: RepeatInput) {
  try {
    return repeatDates(input);
  } catch (error) {
    throw new CrmError("VALIDATION", (error as Error).message);
  }
}
function currentPrice(source: Source) {
  try {
    return quote(
      source.service!.code as ServiceId,
      Number(source.area),
      source.extras.map((e) => ({
        code: e.extra.code as ExtraCode,
        quantity: Number(e.quantity),
      })),
      source.urgent,
    ).total;
  } catch {
    return null;
  }
}
function template(source: Source, input: RepeatInput) {
  const data = copyTemplate(source);
  if (input.finalPrice !== null && input.finalPrice !== data.finalPrice) {
    if (data.basePrice === null)
      throw new CrmError(
        "VALIDATION",
        "У исходной уборки нет финансового расчёта.",
      );
    Object.assign(
      data,
      priceSnapshot(
        data.basePrice,
        data.discountPercent,
        input.finalPrice,
        "Цена согласована при повторении уборки",
      ),
    );
  }
  return data;
}
async function check(
  tx: Tx,
  proposed: PlanningOrder,
  previous: PlanningOrder[] = [],
) {
  const issues = await assessScheduling(tx, proposed);
  // Also validate a batch against itself before any rows are inserted.
  const batchIssues = SchedulingConflictService.check(
    proposed,
    [],
    previous,
  ).filter(
    (i) =>
      i.code === "OVERLAP" ||
      i.code === "OPERATING_GAP" ||
      i.code === "OTHER_DURATION_UNKNOWN",
  );
  return [
    ...issues,
    ...batchIssues.filter((i) => !issues.some((j) => j.key === i.key)),
  ];
}
export async function runCalendarRepeat(
  db: PrismaClient,
  userId: string,
  action: string,
  raw: unknown,
) {
  return db.$transaction(
    async (tx) => {
      if (
        !(await tx.user.count({
          where: { id: userId, role: "ADMIN", active: true },
        }))
      )
        throw new CrmError("FORBIDDEN", "Недостаточно прав.");
      if (action.startsWith("series-"))
        return manageSeries(tx, userId, action, raw);
      const input = repeatInput.parse(raw);
      const hash = createHash("sha256")
        .update(JSON.stringify(input))
        .digest("hex");
      await schedulingLock(tx, "repeat-request", input.requestId);
      const existing = await tx.orderRepeatSeries.findUnique({
        where: { requestId: input.requestId },
        include: { orders: { select: { id: true } } },
      });
      if (existing) {
        if (existing.requestHash !== hash)
          throw new CrmError(
            "STALE",
            "Этот запрос уже создан с другими условиями. Откройте повтор заново.",
          );
        return {
          created: true,
          ids: existing.orders.map((o) => o.id),
          seriesId: existing.id,
        };
      }
      if (action !== "preview" && action !== "create")
        throw new CrmError("VALIDATION", "Неизвестное действие.");
      await schedulingLock(tx, "repeat-source", input.sourceId);
      // Same lock as CRM updates prevents stale templates during confirmation.
      await tx.$queryRawUnsafe(
        "SELECT pg_advisory_xact_lock(hashtext($1))::text",
        "order:" + input.sourceId,
      );
      const source = await sourceFor(tx, input),
        data = template(source, input),
        starts = dates(input);
      await lockCrew(tx, input.cleanerIds);
      const rows: {
          start: string;
          issues: SchedulingIssue[];
          duplicate: boolean;
          existing?: boolean;
        }[] = [],
        plans: PlanningOrder[] = [];
      for (const start of starts) {
        const instant = localInstant(start);
        if (
          input.weekly &&
          source.scheduledStart?.getTime() === instant.getTime() &&
          !["CANCELLED", "NO_SHOW"].includes(source.status)
        ) {
          rows.push({ start, issues: [], duplicate: false, existing: true });
          continue;
        }
        const proposed: PlanningOrder = {
          ...data,
          id: randomUUID(),
          status: "DRAFT",
          scheduleMode: "FIXED",
          scheduledStart: instant,
          windowFrom: null,
          windowTo: null,
          cleanerIds: input.cleanerIds,
        };
        const duplicate = Boolean(
          await tx.order.count({
            where: {
              clientId: source.clientId,
              addressId: source.addressId,
              serviceId: source.serviceId,
              scheduledStart: instant,
              status: { notIn: ["CANCELLED", "NO_SHOW"] },
            },
          }),
        );
        rows.push({
          start,
          issues: await check(tx, proposed, plans),
          duplicate,
        });
        plans.push(proposed);
      }
      const newRows = rows.filter((r) => !r.existing);
      if (!newRows.length)
        throw new CrmError(
          "VALIDATION",
          "В выбранном диапазоне нет новых дат для создания.",
        );
      const preview = {
        rows,
        count: newRows.length,
        client: source.client.name,
        address: source.address.fullAddress,
        service: source.service!.name,
        area: Number(source.area),
        extras: source.extras.map((e) => ({
          name: e.extra.name,
          quantity: Number(e.quantity),
        })),
        copiedPrice:
          source.finalPrice === null ? null : Number(source.finalPrice),
        currentPrice: currentPrice(source),
        price: data.finalPrice,
        duration: data.manualDurationMinutes ?? data.estimatedDurationMinutes,
        requiredCleaners: data.requiredCleaners,
      };
      if (action === "preview") return preview;
      const issues = rows.flatMap((r) => r.issues);
      if (issues.length)
        throw new SchedulingError(
          issues,
          "На это время есть конфликт или не завершена проверка расписания. Измените команду/время.",
        );
      if (rows.some((r) => r.duplicate) && !input.allowDuplicate)
        throw new CrmError(
          "DUPLICATE",
          "Возможный дубль на выбранную дату. Подтвердите отдельное создание.",
        );
      const series = await tx.orderRepeatSeries.create({
        data: {
          requestId: input.requestId,
          requestHash: hash,
          sourceOrderId: source.id,
          template: JSON.parse(
            JSON.stringify({
              ...data,
              extras: source.extras.map((e) => ({
                extraId: e.extraId,
                quantity: Number(e.quantity),
                unitPrice: Number(e.unitPrice),
                durationMinutes: e.durationMinutes,
              })),
              cleanerIds: input.cleanerIds,
            }),
          ),
          weekly: input.weekly,
          weekdays: input.weekdays,
          endsOn: new Date(rows.at(-1)!.start.slice(0, 10) + "T00:00:00Z"),
        },
      });
      const ids: string[] = [];
      for (const row of newRows) {
        const order = await tx.order.create({
          data: {
            ...data,
            reference: "REP-" + randomUUID().slice(0, 8).toUpperCase(),
            requestId: input.requestId + ":" + row.start,
            copiedFromId: source.id,
            repeatSeriesId: series.id,
            status: "DRAFT",
            source: "MANUAL",
            scheduleMode: "FIXED",
            scheduledStart: localInstant(row.start),
            internalComment: input.comment || null,
            extras: {
              create: source.extras.map((e) => ({
                extraId: e.extraId,
                quantity: e.quantity,
                unitPrice: e.unitPrice,
                durationMinutes: e.durationMinutes,
              })),
            },
            assignments: {
              create: input.cleanerIds.map((cleanerId) => ({ cleanerId })),
            },
          },
        });
        ids.push(order.id);
        await writeAudit(
          tx,
          { type: "USER", userId },
          {
            action: "ORDER_REPEATED",
            entityType: "Order",
            entityId: order.id,
            changes: {
              orderId: { before: source.id, after: order.id },
              scheduledStart: { before: null, after: row.start },
              finalPrice: { before: null, after: String(data.finalPrice) },
            },
          },
        );
      }
      await writeAudit(
        tx,
        { type: "USER", userId },
        {
          action: "ORDER_SERIES_CREATED",
          entityType: "OrderRepeatSeries",
          entityId: series.id,
          changes: { changedFields: { before: null, after: ids } },
        },
      );
      return { created: true, ids, seriesId: series.id };
    },
    { maxWait: 10000, timeout: 120000 },
  );
}
export const seriesInput = z
  .object({
    seriesId: z.string().min(1).max(100),
    expectedUpdatedAt: z.string().datetime().optional(),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
      .optional(),
    cleanerIds: z
      .array(z.string().min(1).max(100))
      .max(20)
      .refine((ids) => new Set(ids).size === ids.length)
      .optional(),
    price: z.number().finite().min(0).max(10000000).multipleOf(0.01).optional(),
    comment: z.string().trim().max(2000).optional(),
    confirmCount: z.number().int().min(0).optional(),
    scopeVersion: z.string().optional(),
  })
  .strict();
async function manageSeries(
  tx: Tx,
  userId: string,
  action: string,
  raw: unknown,
) {
  const input = seriesInput.parse(raw);
  await schedulingLock(tx, "series", input.seriesId);
  const series = await tx.orderRepeatSeries.findUnique({
    where: { id: input.seriesId },
  });
  if (!series || !series.weekly)
    throw new CrmError("NOT_FOUND", "Регулярная серия не найдена.");
  const orders = await tx.order.findMany({
    where: {
      repeatSeriesId: series.id,
      OR: [
        { scheduledStart: { gt: new Date() } },
        { scheduledStart: null, windowFrom: { gt: new Date() } },
      ],
      status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
    },
    include,
    orderBy: { scheduledStart: "asc" },
  });
  const allIds = [
    ...new Set(orders.flatMap((o) => o.assignments.map((a) => a.cleanerId))),
  ];
  const scopeVersion = createHash("sha256")
    .update(
      JSON.stringify(orders.map((o) => [o.id, o.updatedAt.toISOString()])),
    )
    .digest("hex");
  for (const order of [...orders].sort((a, b) => a.id.localeCompare(b.id)))
    await tx.$queryRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1))::text",
      "order:" + order.id,
    );
  await lockCrew(tx, [...allIds, ...(input.cleanerIds ?? [])]);
  if (action === "series-info")
    return {
      seriesId: series.id,
      updatedAt: series.updatedAt.toISOString(),
      scopeVersion,
      stopped: Boolean(series.stoppedAt),
      count: orders.length,
      orders: orders.map((o) => ({
        id: o.id,
        start: localInput(o.scheduledStart ?? o.windowFrom),
        status: o.status,
      })),
    };
  if (series.stoppedAt)
    throw new CrmError("VALIDATION", "Повторение остановлено.");
  if (input.expectedUpdatedAt !== series.updatedAt.toISOString())
    throw new CrmError("STALE", "Серия изменилась. Повторите просмотр.");
  const nowOrders = await tx.order.findMany({
    where: { id: { in: orders.map((o) => o.id) } },
    include,
    orderBy: { scheduledStart: "asc" },
  });
  if (
    nowOrders.some(
      (o, i) => o.updatedAt.toISOString() !== orders[i].updatedAt.toISOString(),
    )
  )
    throw new CrmError("STALE", "Одна из уборок изменена. Повторите просмотр.");
  const plans: PlanningOrder[] = [];
  const rows = [];
  for (const order of orders) {
    if (
      closedStatuses.includes(order.status) ||
      !["DRAFT", "SCHEDULED"].includes(order.status)
    )
      throw new CrmError(
        "VALIDATION",
        "Серия содержит начатую уборку. Измените её отдельно.",
      );
    if (action !== "series-stop" && !order.scheduledStart)
      throw new CrmError(
        "VALIDATION",
        "Уборка переведена в гибкое окно. Разместите её отдельно перед изменением всей серии.",
      );
    const start =
      localInput(order.scheduledStart ?? order.windowFrom).slice(0, 10) +
      "T" +
      (input.time ??
        localInput(order.scheduledStart ?? order.windowFrom).slice(11, 16));
    const proposed: PlanningOrder = {
      ...order,
      scheduledStart: localInstant(start),
      cleanerIds: input.cleanerIds ?? order.assignments.map((a) => a.cleanerId),
    };
    const issues =
      action === "series-stop" ? [] : await check(tx, proposed, plans);
    rows.push({ id: order.id, start, issues });
    plans.push(proposed);
  }
  if (action === "series-preview")
    return {
      rows,
      count: rows.length,
      updatedAt: series.updatedAt.toISOString(),
      scopeVersion,
    };
  if (!["series-update", "series-stop"].includes(action))
    throw new CrmError("VALIDATION", "Неизвестное действие.");
  if (input.confirmCount !== orders.length)
    throw new CrmError(
      "STALE",
      "Количество будущих уборок изменилось. Подтвердите новый масштаб.",
    );
  if (input.scopeVersion !== scopeVersion)
    throw new CrmError(
      "STALE",
      "Будущая уборка изменена. Повторите просмотр серии.",
    );
  const issues = rows.flatMap((r) => r.issues);
  if (issues.length)
    throw new SchedulingError(
      issues,
      "На это время есть конфликт. Изменения серии не сохранены.",
    );
  for (const [index, order] of orders.entries()) {
    if (action === "series-stop")
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "CANCELLED",
          cancellationReason: "Владелец остановил регулярную серию",
        },
      });
    else {
      if (input.price !== undefined && order.basePrice === null)
        throw new CrmError(
          "VALIDATION",
          "У уборки нет исходного финансового расчёта. Согласуйте его отдельно.",
        );
      const financial =
        input.price === undefined
          ? {}
          : priceSnapshot(
              Number(order.basePrice),
              Number(order.discountPercent),
              input.price,
              "Цена будущих уборок согласована владельцем",
            );
      await tx.order.update({
        where: { id: order.id },
        data: {
          scheduledStart: localInstant(rows[index].start),
          ...financial,
          ...(input.comment === undefined
            ? {}
            : { internalComment: input.comment || null }),
        },
      });
      if (input.cleanerIds) {
        await tx.orderCleaner.updateMany({
          where: {
            orderId: order.id,
            removedAt: null,
            cleanerId: { notIn: input.cleanerIds },
          },
          data: { removedAt: new Date() },
        });
        for (const cleanerId of input.cleanerIds)
          await tx.orderCleaner.upsert({
            where: { orderId_cleanerId: { orderId: order.id, cleanerId } },
            create: { orderId: order.id, cleanerId },
            update: {
              removedAt: null,
              assignedAt: new Date(),
              acceptedAt: null,
              startedAt: null,
              finishedAt: null,
            },
          });
      }
    }
    await writeAudit(
      tx,
      { type: "USER", userId },
      {
        action:
          action === "series-stop"
            ? "SERIES_ORDER_CANCELLED"
            : "SERIES_ORDER_UPDATED",
        entityType: "Order",
        entityId: order.id,
        changes: {
          changedFields: {
            before: null,
            after:
              action === "series-stop"
                ? ["status"]
                : [
                    "scheduledStart",
                    ...(input.price === undefined ? [] : ["finalPrice"]),
                    ...(input.cleanerIds ? ["cleanerIds"] : []),
                  ],
          },
        },
      },
    );
  }
  await tx.orderRepeatSeries.update({
    where: { id: series.id },
    data:
      action === "series-stop"
        ? { stoppedAt: new Date() }
        : {
            template: {
              ...(series.template as Record<string, Prisma.InputJsonValue>),
              ...(input.time ? { time: input.time } : {}),
              ...(input.cleanerIds ? { cleanerIds: input.cleanerIds } : {}),
              ...(input.price === undefined ? {} : { finalPrice: input.price }),
            },
          },
  });
  await writeAudit(
    tx,
    { type: "USER", userId },
    {
      action:
        action === "series-stop"
          ? "ORDER_SERIES_STOPPED"
          : "ORDER_SERIES_UPDATED",
      entityType: "OrderRepeatSeries",
      entityId: series.id,
      changes: {
        changedFields: { before: null, after: orders.map((o) => o.id) },
      },
    },
  );
  return { created: true, count: orders.length };
}
