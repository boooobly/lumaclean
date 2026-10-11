import { z } from "zod";
import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  upholsteryCatalogSchema,
  upholsteryRequestSchema,
  calculateUpholstery,
} from "@/lib/upholstery";
import { CrmError, localInstant } from "@/lib/domain/crm";
import { SchedulingError } from "@/lib/domain/scheduling-types";
import { assessScheduling, lockCrew } from "./scheduling-commands";
import { lockExtractor } from "./upholstery-equipment";
import { writeAudit } from "./audit";
import {
  serviceDatePolicy,
  buildAgentTemporalContext,
} from "@/lib/agent/temporal";
const id = z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/),
  minutes = z.number().int().min(0).max(1440).nullable();
export const upholsterySaveSchema = z
  .object({
    requestId: z.uuid(),
    orderId: id.optional(),
    sourceId: id.optional(),
    leadId: id.optional(),
    cleaningMinutes: minutes.default(null),
    clientId: id,
    addressId: id,
    expectedUpdatedAt: z.string().optional(),
    catalogVersion: z.number().int().positive(),
    request: upholsteryRequestSchema,
    scheduledStart: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
    cleanerIds: z
      .array(id)
      .max(10)
      .refine((v) => new Set(v).size === v.length),
    approve: z.boolean(),
    reviewNote: z.string().trim().max(2000),
    photos: z.array(z.url().refine((v) => v.startsWith("https://"))).max(8),
    plannedMinutes: minutes,
    preparationMinutes: minutes,
    cleanupMinutes: minutes,
    transferMinutes: minutes,
    equipmentUnit: z.number().int().min(1).max(20).nullable(),
    equipmentCleanerId: id.nullable(),
    logisticsNote: z.string().trim().max(1500),
    patchTestConfirmed: z.boolean(),
    finalPrice: z.number().int().min(0).max(1000000).nullable(),
    priceReason: z.string().trim().max(1000),
  })
  .strict();
export const upholsterySettingsSchema = z
  .object({
    version: z.number().int().positive(),
    catalog: upholsteryCatalogSchema,
    extractorQuantity: z.number().int().min(0).max(20),
  })
  .strict();
const json = (v: unknown) =>
  JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
const baselineSchema = z.object({
  basePrice: z.number(),
  finalPrice: z.number(),
  discountAmount: z.number(),
  priceAdjustment: z.number(),
  priceChangeReason: z.string().nullable(),
  manualDurationMinutes: z.number().nullable(),
  estimatedDurationMinutes: z.number().nullable(),
});
export async function runUpholsteryCommand(
  db: PrismaClient,
  userId: string,
  action: string,
  payload: unknown,
) {
  return db
    .$transaction(
      async (tx) => {
        if (
          !(await tx.user.count({
            where: { id: userId, role: "ADMIN", active: true },
          }))
        )
          throw new CrmError("FORBIDDEN", "Недостаточно прав");
        const audit = (verb: string, entityId: string) =>
          writeAudit(
            tx,
            { type: "USER", userId },
            { action: verb, entityType: "OrderUpholstery", entityId },
          );
        if (action === "settings") {
          const v = upholsterySettingsSchema.parse(payload);
          await lockExtractor(tx);
          const old = await tx.upholsterySettings.findUniqueOrThrow({
            where: { id: "default" },
          });
          if (old.version !== v.version)
            throw new CrmError("STALE", "Прайс изменился. Обновите страницу.");
          if (
            v.extractorQuantity < old.extractorQuantity &&
            (await tx.orderUpholstery.count({
              where: {
                equipmentUnit: { gt: v.extractorQuantity },
                order: {
                  status: { notIn: ["CANCELLED", "NO_SHOW", "COMPLETED"] },
                },
              },
            }))
          )
            throw new CrmError(
              "VALIDATION",
              "Сначала переназначьте аппарат в открытых заказах.",
            );
          await tx.upholsterySettings.update({
            where: { id: "default" },
            data: {
              catalog: v.catalog,
              extractorQuantity: v.extractorQuantity,
              version: { increment: 1 },
            },
          });
          await audit("UPHOLSTERY_CATALOG_UPDATED", "default");
          return { ok: true };
        }
        if (!["preview", "save"].includes(action))
          throw new CrmError("VALIDATION", "Неизвестное действие");
        const v = upholsterySaveSchema.parse(payload),
          hash = createHash("sha256").update(JSON.stringify(v)).digest("hex");
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`upholstery-request:${v.requestId}`}))::text`;
        if (action === "save" && !v.orderId) {
          const duplicate = await tx.order.findUnique({
            where: { requestId: v.requestId },
            include: { upholstery: true },
          });
          if (duplicate) {
            if (duplicate.upholstery?.requestHash !== hash)
              throw new CrmError(
                "IDEMPOTENCY",
                "Запрос уже использован с другими условиями",
              );
            return { id: duplicate.id, created: false };
          }
        }
        if (v.orderId)
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`order:${v.orderId}`}))::text`;
        const old = v.orderId
          ? await tx.order.findUniqueOrThrow({
              where: { id: v.orderId },
              include: {
                upholstery: true,
                assignments: { where: { removedAt: null } },
                service: true,
              },
            })
          : null;
        if (
          old &&
          (old.historical ||
            ["COMPLETED", "CANCELLED", "NO_SHOW", "IN_PROGRESS"].includes(
              old.status,
            ))
        )
          throw new CrmError(
            "VALIDATION",
            "Закрытый или начатый заказ доступен только для просмотра",
          );
        if (old && old.updatedAt.toISOString() !== v.expectedUpdatedAt)
          throw new CrmError("STALE", "Заказ изменился. Обновите страницу.");
        if (
          old &&
          (old.clientId !== v.clientId || old.addressId !== v.addressId)
        )
          throw new CrmError(
            "VALIDATION",
            "Клиент и адрес существующего заказа не должны меняться в расчёте химчистки",
          );
        if (
          !(await tx.clientAddress.count({
            where: { id: v.addressId, clientId: v.clientId, active: true },
          }))
        )
          throw new CrmError(
            "VALIDATION",
            "Выберите действующий адрес этого клиента",
          );
        if (
          v.sourceId &&
          !(await tx.order.count({
            where: {
              id: v.sourceId,
              clientId: v.clientId,
              addressId: v.addressId,
              upholstery: { isNot: null },
            },
          }))
        )
          throw new CrmError("VALIDATION", "Исходная химчистка не найдена");
        const standalone = old
          ? old.service?.code === "upholstery"
          : v.request.mode === "STANDALONE";
        if (!old && !standalone && !v.request.cleaning)
          throw new CrmError(
            "VALIDATION",
            "Для нового совместного заказа укажите основную уборку",
          );
        if (old && v.request.cleaning)
          throw new CrmError(
            "VALIDATION",
            "Основная уборка уже зафиксирована в заказе",
          );
        if (v.leadId)
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`lead:${v.leadId}`}))::text`;
        const lead = v.leadId
          ? await tx.lead.findUniqueOrThrow({ where: { id: v.leadId } })
          : null;
        if (
          lead &&
          (lead.clientId !== v.clientId ||
            !lead.upholsteryQuote ||
            ["CONVERTED", "LOST"].includes(lead.status))
        )
          throw new CrmError(
            "VALIDATION",
            "Сначала свяжите открытую заявку с выбранным клиентом",
          );
        if (v.request.mode !== (standalone ? "STANDALONE" : "ADDON"))
          throw new CrmError(
            "VALIDATION",
            "Проверьте отдельный или совместный выезд",
          );
        await lockCrew(tx, [
          ...(old?.assignments.map((a) => a.cleanerId) ?? []),
          ...v.cleanerIds,
        ]);
        await lockExtractor(tx);
        if (
          (await tx.cleaner.count({
            where: { id: { in: v.cleanerIds }, active: true },
          })) !== v.cleanerIds.length
        )
          throw new CrmError("VALIDATION", "Выберите активных клинеров");
        const settings = await tx.upholsterySettings.findUniqueOrThrow({
          where: { id: "default" },
        });
        if (settings.version !== v.catalogVersion)
          throw new CrmError(
            "STALE",
            "Прайс обновлён. Повторите предварительный расчёт.",
          );
        const business = await tx.businessSettings.findUniqueOrThrow({
            where: { id: "default" },
          }),
          policy = serviceDatePolicy(v.scheduledStart.slice(0, 10), business);
        if ("error" in policy)
          throw new CrmError(
            "VALIDATION",
            policy.error ?? "Проверьте дату записи",
          );
        const request = {
            ...v.request,
            cleaning: undefined,
            urgent: old ? old.urgent : policy.urgent,
          },
          calculated = calculateUpholstery(
            request,
            upholsteryCatalogSchema.parse(settings.catalog),
            settings.version,
          );
        const combined =
          !old && !standalone
            ? calculateUpholstery(
                { ...v.request, urgent: request.urgent },
                upholsteryCatalogSchema.parse(settings.catalog),
                settings.version,
              )
            : null;
        if (
          v.approve &&
          (calculated.materialRejected ||
            request.items.some((i) => i.fabric !== "WET_COMPATIBLE") ||
            v.reviewNote.length < 8)
        )
          throw new CrmError(
            "VALIDATION",
            "Подтвердите допустимость влажной чистки и обоснуйте проверку материала, фото и итоговой цены",
          );
        if (
          v.approve &&
          request.items.some((i) => i.soil === "HEAVY") &&
          !v.photos.length
        )
          throw new CrmError(
            "VALIDATION",
            "Для сильного загрязнения приложите фото для предварительной оценки",
          );
        const baseline = standalone
          ? null
          : !old
            ? {
                basePrice: combined!.total - calculated.total,
                finalPrice: combined!.total - calculated.total,
                discountAmount: 0,
                priceAdjustment: 0,
                priceChangeReason: null,
                manualDurationMinutes: v.cleaningMinutes,
                estimatedDurationMinutes: null,
              }
            : old.upholstery?.cleaningBaseline
              ? baselineSchema.parse(old!.upholstery.cleaningBaseline)
              : {
                  basePrice: Number(old!.basePrice),
                  finalPrice: Number(old!.finalPrice),
                  discountAmount: Number(old!.discountAmount),
                  priceAdjustment: Number(old!.priceAdjustment ?? 0),
                  priceChangeReason: old!.priceChangeReason,
                  manualDurationMinutes: old!.manualDurationMinutes,
                  estimatedDurationMinutes: old!.estimatedDurationMinutes,
                };
        if (
          old &&
          !standalone &&
          (old.basePrice === null || old.finalPrice === null)
        )
          throw new CrmError(
            "VALIDATION",
            "Сначала согласуйте стоимость основной уборки",
          );
        if (baseline && v.cleaningMinutes !== null)
          baseline.manualDurationMinutes = v.cleaningMinutes;
        if (
          v.approve &&
          !standalone &&
          !(
            baseline?.manualDurationMinutes ??
            baseline?.estimatedDurationMinutes
          )
        )
          throw new CrmError(
            "VALIDATION",
            "Подтвердите длительность основной уборки отдельно от химчистки.",
          );
        const suggested = (baseline?.finalPrice ?? 0) + calculated.total,
          finalPrice = v.finalPrice ?? suggested;
        if (
          standalone &&
          finalPrice <
            Number(
              settings.catalog &&
                upholsteryCatalogSchema.parse(settings.catalog).minimumVisit,
            ) +
              calculated.surcharge
        )
          throw new CrmError(
            "VALIDATION",
            "Отдельный выезд не может быть ниже действующего минимума с применимой срочностью",
          );
        if (finalPrice !== suggested && v.priceReason.length < 8)
          throw new CrmError(
            "VALIDATION",
            "Объясните согласованное изменение цены",
          );
        const minutes =
            (v.plannedMinutes ?? 0) +
            (v.preparationMinutes ?? 0) +
            (v.cleanupMinutes ?? 0) +
            (baseline?.manualDurationMinutes ??
              baseline?.estimatedDurationMinutes ??
              0),
          orderId = old?.id ?? randomUUID();
        if (
          v.approve &&
          (!v.plannedMinutes ||
            v.preparationMinutes === null ||
            v.cleanupMinutes === null ||
            v.transferMinutes === null ||
            !v.equipmentUnit ||
            !v.equipmentCleanerId ||
            v.logisticsNote.length < 8 ||
            !v.cleanerIds.length)
        )
          throw new CrmError(
            "VALIDATION",
            "Для подтверждения заполните длительность, подготовку, очистку, перевозку, аппарат и ответственного из команды",
          );
        if (v.approve && !old && !standalone && !v.cleaningMinutes)
          throw new CrmError(
            "VALIDATION",
            "Подтвердите длительность основной уборки",
          );
        const service = old
          ? old.service!
          : await tx.service.findUniqueOrThrow({
              where: {
                code: standalone ? "upholstery" : v.request.cleaning!.service,
              },
            });
        if (!service.active)
          throw new CrmError("VALIDATION", "Услуга отключена");
        const duplicate = !old
          ? await tx.order.findFirst({
              where: {
                clientId: v.clientId,
                addressId: v.addressId,
                serviceId: service.id,
                scheduledStart: localInstant(v.scheduledStart),
                status: { notIn: ["CANCELLED", "NO_SHOW"] },
              },
            })
          : null;
        if (duplicate)
          throw new CrmError(
            "DUPLICATE",
            "На эту дату уже есть такой заказ. Откройте его карточку.",
          );
        const data = {
          scheduledStart: localInstant(v.scheduledStart),
          scheduledEnd: minutes
            ? new Date(
                localInstant(v.scheduledStart).getTime() + minutes * 60000,
              )
            : null,
          scheduleMode: "FIXED" as const,
          windowFrom: null,
          windowTo: null,
          manualDurationMinutes: minutes || null,
          durationOverrideReason: v.approve
            ? `Согласовано владельцем: ${v.reviewNote}`
            : "Предварительный план химчистки — требуется review",
          requiredCleaners: v.cleanerIds.length || 1,
          status: "DRAFT" as const,
          urgent: request.urgent,
          basePrice: (baseline?.basePrice ?? 0) + calculated.total,
          finalPrice,
          discountAmount: baseline?.discountAmount ?? 0,
          priceAdjustment:
            finalPrice -
            ((baseline?.basePrice ?? 0) +
              calculated.total -
              (baseline?.discountAmount ?? 0)),
          priceChangeReason:
            finalPrice !== suggested
              ? v.priceReason
              : (baseline?.priceChangeReason ?? null),
        };
        if (!old)
          await tx.order.create({
            data: {
              id: orderId,
              requestId: v.requestId,
              copiedFromId: v.sourceId ?? null,
              clientId: v.clientId,
              addressId: v.addressId,
              serviceId: service.id,
              pricingBasis: standalone ? "ITEMS" : "AREA",
              leadId: lead?.id ?? null,
              area: standalone ? 0 : (v.request.cleaning?.area ?? 0),
              travelBufferMinutes: business.defaultTravelBufferMinutes,
              reference: `UP-${randomUUID().slice(0, 8).toUpperCase()}`,
              source: "MANUAL",
              ...data,
            },
          });
        const detail = {
          input: json(request),
          quote: json({
            ...calculated,
            cleaningBaseline: baseline?.finalPrice ?? 0,
            suggestedTotal: suggested,
            agreedTotal: finalPrice,
            enquiryId: lead?.id ?? null,
          }),
          cleaningBaseline: baseline ? json(baseline) : Prisma.JsonNull,
          requestHash: hash,
          reviewStatus: v.approve ? "APPROVED" : "PENDING",
          reviewNote: v.reviewNote,
          reviewedBy: v.approve ? userId : null,
          photos: json(v.photos),
          plannedMinutes: v.plannedMinutes,
          preparationMinutes: v.preparationMinutes,
          cleanupMinutes: v.cleanupMinutes,
          transferMinutes: v.transferMinutes,
          equipmentUnit: v.equipmentUnit,
          equipmentCleanerId: v.equipmentCleanerId,
          logisticsNote: v.logisticsNote,
          patchTestConfirmed: v.patchTestConfirmed,
        };
        await tx.orderUpholstery.upsert({
          where: { orderId },
          create: { orderId, ...detail },
          update: detail,
        });
        const issues = v.approve
          ? await assessScheduling(tx, {
              ...(old ?? {}),
              ...data,
              id: orderId,
              addressId: v.addressId,
              estimatedDurationMinutes: null,
              cleaningReserveMinutes: old?.cleaningReserveMinutes ?? 0,
              travelBufferMinutes:
                old?.travelBufferMinutes ?? business.defaultTravelBufferMinutes,
              cleanerIds: v.cleanerIds,
            })
          : [];
        if (v.approve && issues.length && action === "save")
          throw new SchedulingError(issues);
        if (action === "preview") {
          throw new PreviewRollback({
            quote: {
              ...calculated,
              cleaningBaseline: baseline?.finalPrice ?? 0,
              suggestedTotal: suggested,
              agreedTotal: finalPrice,
            },
            issues,
            pendingReview: !v.approve,
            scope:
              "Сохранение создаёт/обновляет только этот черновик. Подтверждение заказа — отдельное действие в карточке.",
          });
        }
        if (old) await tx.order.update({ where: { id: orderId }, data });
        await tx.orderCleaner.updateMany({
          where: {
            orderId,
            removedAt: null,
            cleanerId: { notIn: v.cleanerIds },
          },
          data: { removedAt: new Date() },
        });
        for (const cleanerId of v.cleanerIds)
          await tx.orderCleaner.upsert({
            where: { orderId_cleanerId: { orderId, cleanerId } },
            create: { orderId, cleanerId },
            update: { removedAt: null },
          });
        if (lead) {
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              status: "CONVERTED",
              upholsteryQuote: json({
                ...(lead.upholsteryQuote as Prisma.JsonObject),
                convertedOrderId: orderId,
              }),
            },
          });
          await writeAudit(
            tx,
            { type: "USER", userId },
            {
              action: "LEAD_CONVERTED",
              entityType: "Lead",
              entityId: lead.id,
              changes: {
                orderId: { before: null, after: orderId },
                status: { before: lead.status, after: "CONVERTED" },
              },
            },
          );
        }
        await audit(
          old ? "UPHOLSTERY_UPDATED" : "UPHOLSTERY_ORDER_CREATED",
          orderId,
        );
        return { id: orderId, created: !old };
      },
      { timeout: 60000 },
    )
    .catch((e) => {
      if (e instanceof PreviewRollback) return e.result;
      throw e;
    });
}
class PreviewRollback extends Error {
  constructor(public result: unknown) {
    super("preview");
  }
}
export async function publicUpholsteryQuote(
  db: PrismaClient,
  payload: unknown,
) {
  const parsed = z
    .object({
      request: upholsteryRequestSchema,
      requestedDate: z.iso.date().optional(),
    })
    .strict()
    .parse(payload);
  const settings = await db.upholsterySettings.findUniqueOrThrow({
      where: { id: "default" },
    }),
    business = await db.businessSettings.findUniqueOrThrow({
      where: { id: "default" },
    });
  if (parsed.request.urgent || parsed.requestedDate) {
    const now = new Date(),
      date =
        parsed.requestedDate ??
        buildAgentTemporalContext(now, business, now).nowLocalDate,
      policy = serviceDatePolicy(date, business, now);
    if ("error" in policy)
      throw new CrmError("VALIDATION", policy.error ?? "Проверьте дату записи");
    parsed.request.urgent = policy.urgent;
  }
  return calculateUpholstery(
    parsed.request,
    upholsteryCatalogSchema.parse(settings.catalog),
    settings.version,
  );
}
