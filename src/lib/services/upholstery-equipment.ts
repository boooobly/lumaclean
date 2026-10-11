import type { Prisma } from "@/generated/prisma/client";
import type { PlanningOrder } from "@/lib/domain/scheduling-conflicts";
import type { SchedulingIssue } from "@/lib/domain/scheduling-types";
import { plannedEnd } from "@/lib/domain/scheduling-conflicts";
import {
  extractorIntervalsConflict,
  upholsteryRequestSchema,
} from "@/lib/upholstery";
type Tx = Prisma.TransactionClient;
export async function lockExtractor(tx: Tx) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${"scheduling:equipment:extractor"}))::text`;
}
export async function upholsteryIssues(
  tx: Tx,
  order: PlanningOrder,
): Promise<SchedulingIssue[]> {
  const detail = await tx.orderUpholstery.findUnique({
    where: { orderId: order.id },
  });
  if (!detail || ["CANCELLED", "NO_SHOW"].includes(order.status)) return [];
  await lockExtractor(tx);
  const problems: SchedulingIssue[] = [],
    fail = (code: string, message: string) =>
      problems.push({
        key: `${code}:${order.id}`,
        code,
        severity: "ERROR",
        message,
      });
  const settings = await tx.upholsterySettings.findUniqueOrThrow({
      where: { id: "default" },
    }),
    input = upholsteryRequestSchema.parse(detail.input);
  if (
    detail.reviewStatus !== "APPROVED" ||
    input.items.some((i) => i.fabric !== "WET_COMPATIBLE") ||
    !detail.reviewNote?.trim()
  )
    fail(
      "UPHOLSTERY_REVIEW",
      "Химчистка требует проверки материала, фото и согласования цены владельцем.",
    );
  if (
    !detail.plannedMinutes ||
    detail.preparationMinutes === null ||
    detail.cleanupMinutes === null ||
    detail.transferMinutes === null ||
    !detail.logisticsNote?.trim()
  )
    fail(
      "EXTRACTOR_DURATION",
      "Подтвердите длительность работы, подготовку, очистку аппарата и перевозку. Нормы пока не откалиброваны.",
    );
  if (
    !detail.equipmentUnit ||
    detail.equipmentUnit > settings.extractorQuantity
  )
    fail(
      "EXTRACTOR_UNAVAILABLE",
      "Выберите доступную единицу экстракторного оборудования.",
    );
  if (
    !detail.equipmentCleanerId ||
    !order.cleanerIds.includes(detail.equipmentCleanerId)
  )
    fail(
      "EXTRACTOR_CUSTODIAN",
      "Назначьте ответственного за аппарат из команды заказа.",
    );
  if (
    ["IN_PROGRESS", "COMPLETED"].includes(order.status) &&
    !detail.patchTestConfirmed
  )
    fail(
      "PATCH_TEST_REQUIRED",
      "Перед началом влажной обработки подтвердите пробу на стойкость окраски и совместимость ткани.",
    );
  const cleaning = detail.cleaningBaseline as {
    manualDurationMinutes?: number | null;
    estimatedDurationMinutes?: number | null;
  } | null;
  const cleaningMinutes =
    cleaning?.manualDurationMinutes ?? cleaning?.estimatedDurationMinutes;
  if (input.mode === "ADDON" && !cleaningMinutes)
    fail(
      "CLEANING_DURATION",
      "Длительность основной уборки должна быть подтверждена отдельно.",
    );
  const end = plannedEnd(order),
    minimum =
      (detail.plannedMinutes ?? 0) +
      (detail.preparationMinutes ?? 0) +
      (detail.cleanupMinutes ?? 0) +
      (cleaningMinutes ?? 0);
  const duration =
    order.manualDurationMinutes ?? order.estimatedDurationMinutes;
  if (duration === null || duration < minimum)
    fail(
      "EXTRACTOR_DURATION",
      "Интервал заказа должен включать подготовку, саму химчистку и очистку оборудования.",
    );
  if (!order.scheduledStart || !end) {
    fail(
      "EXTRACTOR_START_REQUIRED",
      "Для резервирования аппарата нужен проверенный фиксированный интервал.",
    );
    return problems;
  }
  const others = await tx.orderUpholstery.findMany({
    where: {
      orderId: { not: order.id },
      order: { status: { notIn: ["CANCELLED", "NO_SHOW"] }, historical: false },
    },
    include: { order: true },
    take: 1001,
  });
  if (others.length > 1000) {
    fail(
      "EXTRACTOR_REVIEW_LIMIT",
      "Слишком много заказов с аппаратом для безопасной автоматической проверки.",
    );
    return problems;
  }
  for (const other of others) {
    if (
      other.equipmentUnit !== detail.equipmentUnit &&
      other.equipmentUnit !== null
    )
      continue;
    const start = other.order.scheduledStart ?? other.order.windowFrom;
    if (!start) continue;
    const minutes =
      other.order.manualDurationMinutes ?? other.order.estimatedDurationMinutes;
    const otherEnd =
      minutes !== null
        ? new Date(
            start.getTime() +
              (minutes + other.order.cleaningReserveMinutes) * 60000,
          )
        : other.order.windowTo;
    if (!otherEnd) {
      if (Math.abs(start.getTime() - order.scheduledStart.getTime()) < 86400000)
        fail(
          "EXTRACTOR_UNKNOWN_INTERVAL",
          "Другой заказ с экстрактором имеет неподтверждённую длительность.",
        );
      continue;
    }
    if (
      extractorIntervalsConflict(
        {
          start: order.scheduledStart,
          end: new Date(end.getTime() + order.cleaningReserveMinutes * 60000),
          transferMinutes: detail.transferMinutes ?? 0,
        },
        { start, end: otherEnd, transferMinutes: other.transferMinutes ?? 0 },
      )
    )
      fail(
        "EXTRACTOR_CONFLICT",
        `Аппарат занят в другом заказе (${other.order.reference ?? other.orderId}); учтена перевозка и очистка.`,
      );
  }
  return problems;
}
