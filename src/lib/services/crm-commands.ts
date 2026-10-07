// Transport-independent commands. HTTP callers supply a session-derived actor;
// every transaction checks that actor against the current database role again.
import { randomUUID } from "node:crypto";
import { orderNotifications } from '@/lib/agent/notifications';
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { commandSchemas, type CommandName } from "@/lib/validation/crm";
import {
  assertTransition,
  CrmError,
  localInstant,
  normalizedPhone,
} from "@/lib/domain/crm";
import { quote, priceSnapshot } from "@/lib/domain/crm-pricing";
import { writeAudit, type AuditChanges } from "./audit";
import { lockCrew, enforceScheduling } from "./scheduling-commands";
import { normalizeAddress } from "./google-places";
import { durationData, overrideReason } from "./duration-engine";
import { completeEconomics } from "./payout-calculation";

type Tx = Prisma.TransactionClient;
export class DuplicateClientError extends CrmError {
  constructor(public matches: { id: string; name: string; phone: string | null }[]) {
    super("DUPLICATE", "Возможно, клиент уже существует", "phone");
  }
}
const reference = (prefix: string) =>
  `${prefix}-${new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()).replaceAll("-", "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
async function lock(tx: Tx, kind: string, id: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`${kind}:${id}`}))::text`;
}
async function leadForChange(tx: Tx, id: string) {
  await lock(tx, "lead", id);
  const lead = await tx.lead.findUnique({ where: { id } });
  if (!lead) throw new CrmError("NOT_FOUND", "Заявка не найдена");
  return lead;
}
async function clientExists(tx: Tx, id: string) {
  const client = await tx.client.findUnique({ where: { id } });
  if (!client) throw new CrmError("NOT_FOUND", "Клиент не найден");
  return client;
}
async function duplicates(tx: Tx, phone: string | null, allow: boolean) {
  const normalized = normalizedPhone(phone);
  if (normalized) {
    await lock(tx, "phone", normalized);
    const matches = await tx.client.findMany({
      where: { normalizedPhone: normalized },
      select: { id: true, name: true, phone: true },
      take: 10,
    });
    if (matches.length && !allow) throw new DuplicateClientError(matches);
  }
  return normalized;
}
type ClientInput = ReturnType<
  (typeof commandSchemas)["client-create"]["parse"]
>["client"];
async function newClient(
  tx: Tx,
  input: ClientInput,
  allow: boolean,
  userId: string,
) {
  const normalized = await duplicates(tx, input.phone, allow);
  const client = await tx.client.create({
    data: { ...input, normalizedPhone: normalized },
  });
  await writeAudit(
    tx,
    { type: "USER", userId },
    { action: "CLIENT_CREATED", entityType: "Client", entityId: client.id },
  );
  return client;
}
function schedule(
  input: ReturnType<(typeof commandSchemas)["order-update"]["parse"]>["order"],
) {
  if (input.scheduleMode === "FIXED")
    return {
      scheduleMode: input.scheduleMode,
      scheduledStart: localInstant(input.scheduledStart!),
      windowFrom: null,
      windowTo: null,
    };
  const from = localInstant(input.windowFrom!),
    to = localInstant(input.windowTo!);
  if (from >= to)
    throw new CrmError(
      "VALIDATION",
      "Конец окна должен быть позже начала.",
      "windowTo",
    );
  return {
    scheduleMode: input.scheduleMode,
    scheduledStart: null,
    windowFrom: from,
    windowTo: to,
  };
}
async function orderData(
  tx: Tx,
  input: ReturnType<(typeof commandSchemas)["order-update"]["parse"]>["order"],
  discount: number,
) {
  const service = await tx.service.findUnique({
    where: { code: input.service },
    select: { id: true, active: true },
  });
  if (!service?.active)
    throw new CrmError("VALIDATION", "Услуга недоступна.", "service");
  const calculated = quote(
    input.service,
    input.area,
    input.extras,
    input.urgent,
  );
  const codes = calculated.extras.map((e) => e.code);
  const catalogue = await tx.serviceExtra.findMany({
    where: { code: { in: codes }, active: true },
    select: { id: true, code: true },
  });
  if (catalogue.length !== codes.length)
    throw new CrmError(
      "VALIDATION",
      "Дополнительная услуга недоступна.",
      "extras",
    );
  const data = {
    serviceId: service.id,
    area: input.area,
    soilLevel: input.soilLevel,
    urgent: input.urgent,
    requiredCleaners: input.requiredCleaners,
    manualDurationMinutes: input.manualDurationMinutes ?? null,
    ...(await durationData(tx, {
      serviceId: service.id,
      area: input.area,
      soilLevel: input.soilLevel,
      requiredCleaners: input.requiredCleaners,
      extras: input.extras,
    })),
    clientComment: input.clientComment,
    internalComment: input.internalComment,
    ...schedule(input),
    ...priceSnapshot(
      calculated.total,
      discount,
      input.finalPrice ?? null,
      input.priceChangeReason,
    ),
  };
  return {
    data,
    extras: calculated.extras.map((e) => ({
      extraId: catalogue.find((c) => c.code === e.code)!.id,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
    })),
  };
}
function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Object.keys(after).filter(
    (key) => String(before[key] ?? "") !== String(after[key] ?? ""),
  );
}

export async function runCrmCommand(
  db: PrismaClient,
  userId: string,
  command: CommandName,
  payload: unknown,
): Promise<{ id: string }> {
  // Parse in each narrowed branch below, and keep all effects in one transaction.
  return db.$transaction(
    async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: userId },
        select: { role: true, active: true },
      });
      if (!actor?.active || actor.role !== "ADMIN")
        throw new CrmError("FORBIDDEN", "Недостаточно прав");
      const audit = (
        action: string,
        entityType: string,
        entityId: string,
        changes?: AuditChanges,
      ) =>
        writeAudit(
          tx,
          { type: "USER", userId },
          { action, entityType, entityId, changes },
        );
      if (command === "lead-create") {
        const v = commandSchemas[command].parse(payload);
        const service = await tx.service.findUnique({
          where: { code: v.service },
          select: { id: true, active: true },
        });
        if (!service?.active)
          throw new CrmError("VALIDATION", "Услуга недоступна", "service");
        const { service: _, ...fields } = v;
        void _;
        const lead = await tx.lead.create({
          data: {
            ...fields,
            serviceId: service.id,
            normalizedPhone: normalizedPhone(v.phone),
            reference: reference("LC"),
            telegramStatus: "CANCELLED",
          },
        });
        await audit("LEAD_CREATED", "Lead", lead.id);
        return { id: lead.id };
      }
      if (
        command === "lead-status" ||
        command === "lead-note" ||
        command === "lead-link"
      ) {
        const id = (payload as { id?: unknown })?.id;
        if (typeof id !== "string")
          throw new CrmError("VALIDATION", "Укажите заявку");
        const lead = await leadForChange(tx, id);
        if (command === "lead-status") {
          const v = commandSchemas[command].parse(payload);
          assertTransition("Lead", lead.status, v.status);
          if (v.status === "LOST" && !v.reason)
            throw new CrmError(
              "VALIDATION",
              "Укажите причину закрытия",
              "reason",
            );
          await tx.lead.update({
            where: { id },
            data: {
              status: v.status,
              lostReason: v.status === "LOST" ? v.reason : null,
            },
          });
          await audit("LEAD_STATUS_CHANGED", "Lead", id, {
            status: { before: lead.status, after: v.status },
          });
        } else if (command === "lead-note") {
          const v = commandSchemas[command].parse(payload);
          await tx.lead.update({
            where: { id },
            data: { internalNote: v.note },
          });
          await audit("LEAD_NOTE_CHANGED", "Lead", id, {
            changedFields: { before: null, after: ["internalNote"] },
          });
        } else {
          const v = commandSchemas[command].parse(payload);
          if (lead.status === "CONVERTED")
            throw new CrmError(
              "TRANSITION",
              "Клиент уже закреплён за созданным заказом",
            );
          await clientExists(tx, v.clientId);
          await tx.lead.update({
            where: { id },
            data: { clientId: v.clientId },
          });
          await audit("LEAD_LINKED", "Lead", id, {
            clientId: { before: lead.clientId, after: v.clientId },
          });
        }
        return { id };
      }
      if (command === "client-create") {
        const v = commandSchemas[command].parse(payload);
        const lead = v.leadId ? await leadForChange(tx, v.leadId) : null;
        if (lead?.status === "CONVERTED")
          throw new CrmError("TRANSITION", "Заявка уже конвертирована");
        const client = await newClient(tx, v.client, v.allowDuplicate, userId);
        if (lead) {
          await tx.lead.update({
            where: { id: lead.id },
            data: { clientId: client.id },
          });
          await audit("LEAD_LINKED", "Lead", lead.id, {
            clientId: { before: lead.clientId, after: client.id },
          });
        }
        return { id: client.id };
      }
      if (command === "client-update") {
        const v = commandSchemas[command].parse(payload);
        await lock(tx, "client", v.id);
        const before = await clientExists(tx, v.id);
        await tx.client.update({
          where: { id: v.id },
          data: {
            ...v.client,
            normalizedPhone: normalizedPhone(v.client.phone),
          },
        });
        await audit("CLIENT_UPDATED", "Client", v.id, {
          changedFields: {
            before: null,
            after: changedFields(before, v.client),
          },
        });
        return { id: v.id };
      }
      if (command === "address-create") {
        const v = commandSchemas[command].parse(payload);
        await clientExists(tx, v.clientId);
        const address = await tx.clientAddress.create({
          data: { ...normalizeAddress(v.address), clientId: v.clientId },
        });
        await audit("ADDRESS_CREATED", "Client", v.clientId, {
          changedFields: { before: null, after: ["addresses"] },
        });
        return { id: address.id };
      }
      if (command === "address-update" || command === "address-active") {
        const v = commandSchemas[command].parse(payload);
        await lock(tx, "address", v.id);
        const address = await tx.clientAddress.findFirst({
          where: { id: v.id, clientId: v.clientId },
        });
        if (!address)
          throw new CrmError("NOT_FOUND", "Адрес клиента не найден");
        if (command === "address-update") {
          const inputAddress = commandSchemas[command].parse(payload).address;
          const data = normalizeAddress(inputAddress, address);
          const affected = await tx.orderCleaner.findMany({
            where: { removedAt: null, order: { addressId: v.id } },
            select: { cleanerId: true },
            take: 1001,
          });
          if (affected.length > 1000)
            throw new CrmError(
              "VALIDATION",
              "Слишком много назначений для изменения адреса.",
            );
          await lockCrew(
            tx,
            affected.map((a) => a.cleanerId),
          );
          await tx.clientAddress.update({ where: { id: v.id }, data });
          await audit("ADDRESS_UPDATED", "Client", v.clientId, {
            changedFields: {
              before: null,
              after: changedFields(address, data),
            },
          });
        } else {
          const active = commandSchemas[command].parse(payload).active;
          await tx.clientAddress.update({
            where: { id: v.id },
            data: { active },
          });
          await audit("ADDRESS_ACTIVE_CHANGED", "Client", v.clientId, {
            active: { before: address.active, after: active },
          });
        }
        return { id: v.clientId };
      }
      if (command === "order-create") {
        const v = commandSchemas[command].parse(payload);
        await lock(tx, "request", v.requestId);
        const previous = await tx.order.findUnique({
          where: { requestId: v.requestId },
          select: { id: true },
        });
        if (previous) return previous;
        const lead = v.leadId ? await leadForChange(tx, v.leadId) : null;
        if (lead && (lead.status === "CONVERTED" || lead.status === "LOST"))
          throw new CrmError(
            "TRANSITION",
            "Откройте заявку заново перед созданием заказа",
          );
        if (lead && (await tx.order.count({ where: { leadId: lead.id } })))
          throw new CrmError("TRANSITION", "У заявки уже есть заказ");
        const client = v.clientId
          ? await clientExists(tx, v.clientId)
          : await newClient(tx, v.newClient!, v.allowDuplicate, userId);
        let addressId = v.addressId;
        if (addressId) {
          await lock(tx, "address", addressId);
          const address = await tx.clientAddress.findFirst({
            where: { id: addressId, clientId: client.id, active: true },
            select: { id: true },
          });
          if (!address)
            throw new CrmError(
              "VALIDATION",
              "Выберите активный адрес этого клиента",
              "addressId",
            );
        } else {
          const address = await tx.clientAddress.create({
            data: { ...normalizeAddress(v.newAddress!), clientId: client.id },
          });
          addressId = address.id;
          await audit("ADDRESS_CREATED", "Client", client.id, {
            changedFields: { before: null, after: ["addresses"] },
          });
        }
        const settings = await tx.businessSettings.findUniqueOrThrow({
          where: { id: "default" },
        });
        const result = await orderData(
          tx,
          v.order,
          Number(client.discountPercent ?? 0),
        );
        if (
          v.order.scheduleMode === "FLEXIBLE" &&
          v.suggestedCleanerIds.length &&
          v.order.scheduledStart
        )
          result.data.scheduledStart = localInstant(v.order.scheduledStart);
        const durationOverrideReason = overrideReason(
          v.order.manualDurationMinutes ?? null,
          result.data.estimatedDurationMinutes,
          v.order.durationOverrideReason,
        );
        const order = await tx.order.create({
          data: {
            ...result.data,
            durationOverrideReason,
            reference: reference("ORD"),
            requestId: v.requestId,
            clientId: client.id,
            addressId: addressId!,
            leadId: lead?.id,
            source: lead?.channel ?? "MANUAL",
            travelBufferMinutes: settings.defaultTravelBufferMinutes,
            currency: "RSD",
            extras: { create: result.extras },
          },
        });
        await audit("ORDER_CREATED", "Order", order.id);
        if (order.manualDurationMinutes !== null)
          await audit("ORDER_DURATION_OVERRIDDEN", "Order", order.id, {
            manualDurationMinutes: {
              before: null,
              after: String(order.manualDurationMinutes),
            },
            estimatedDurationMinutes: {
              before: null,
              after:
                order.estimatedDurationMinutes === null
                  ? null
                  : String(order.estimatedDurationMinutes),
            },
          });
        if (v.suggestedCleanerIds.length) {
          await lockCrew(tx, v.suggestedCleanerIds);
          if (
            (await tx.cleaner.count({
              where: { id: { in: v.suggestedCleanerIds }, active: true },
            })) !== v.suggestedCleanerIds.length
          )
            throw new CrmError(
              "VALIDATION",
              "Выберите активных клинеров заново.",
            );
          await enforceScheduling(
            tx,
            { ...order, cleanerIds: v.suggestedCleanerIds },
            userId,
          );
          await tx.orderCleaner.createMany({
            data: v.suggestedCleanerIds.map((cleanerId) => ({
              orderId: order.id,
              cleanerId,
            })),
          });
          await audit("CLEANER_ASSIGNED", "Order", order.id, {
            cleanerIds: { before: [], after: v.suggestedCleanerIds },
          });
        }
        await audit("CLIENT_ORDER_CREATED", "Client", client.id, {
          orderId: { before: null, after: order.id },
        });
        if (lead) {
          await tx.lead.update({
            where: { id: lead.id },
            data: {
              clientId: client.id,
              status: "CONVERTED",
              lostReason: null,
            },
          });
          await audit("LEAD_CONVERTED", "Lead", lead.id, {
            status: { before: lead.status, after: "CONVERTED" },
            clientId: { before: lead.clientId, after: client.id },
            orderId: { before: null, after: order.id },
          });
        }
        await orderNotifications(tx,order.id,'BOOKED',`crm:${order.id}:created`);
        return { id: order.id };
      }
      if (command === "order-update" || command === "order-status") {
        const v = commandSchemas[command].parse(payload);
        await lock(tx, "order", v.id);
        const storedOrder = await tx.order.findUnique({ where: { id: v.id } });
        if (!storedOrder) throw new CrmError("NOT_FOUND", "Заказ не найден");
        if (storedOrder.historical || !storedOrder.serviceId)
          throw new CrmError("VALIDATION", "Исторический заказ доступен только для просмотра");
        // One query at a time on the transaction connection. Prisma relation
        // loading otherwise runs sibling queries concurrently in adapter-pg.
        const extras = await tx.orderExtra.findMany({
          where: { orderId: v.id },
        });
        const service = await tx.service.findUniqueOrThrow({
          where: { id: storedOrder.serviceId },
          select: { code: true },
        });
        const order = { ...storedOrder, serviceId: storedOrder.serviceId, extras, service };
        if (command === "order-status") {
          const input = commandSchemas[command].parse(payload);
          assertTransition("Order", order.status, input.status);
          if (["CANCELLED", "NO_SHOW"].includes(input.status) && !input.reason)
            throw new CrmError("VALIDATION", "Укажите причину", "reason");
          if (input.status === "COMPLETED" && order.finalPrice === null)
            throw new CrmError(
              "VALIDATION",
              "Укажите финальную цену перед завершением",
            );
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: input.status,
              completedAt: input.status === "COMPLETED" ? new Date() : null,
              cancellationReason: ["CANCELLED", "NO_SHOW"].includes(
                input.status,
              )
                ? input.reason
                : null,
            },
          });
          if (input.status === "COMPLETED")
            await completeEconomics(tx, order.id, userId);
          await audit(
            input.status === "COMPLETED"
              ? "ORDER_COMPLETED"
              : input.status === "CANCELLED"
                ? "ORDER_CANCELLED"
                : "ORDER_STATUS_CHANGED",
            "Order",
            order.id,
            { status: { before: order.status, after: input.status } },
          );
        } else {
          if (["COMPLETED", "CANCELLED", "NO_SHOW"].includes(order.status))
            throw new CrmError(
              "TRANSITION",
              "Закрытый заказ доступен только для просмотра",
            );
          const update = commandSchemas[command].parse(payload);
          const input = update.order;
          if (update.addressId && update.addressId !== order.addressId) {
            await lock(tx, "address", update.addressId);
            if (
              !(await tx.clientAddress.count({
                where: {
                  id: update.addressId,
                  clientId: order.clientId,
                  active: true,
                },
              }))
            )
              throw new CrmError(
                "VALIDATION",
                "Выберите активный адрес этого клиента",
                "addressId",
              );
          }
          // Reuse stored amounts when scope is unchanged. A new catalogue never rewrites history.
          const sameScope =
            order.service.code === input.service &&
            Number(order.area) === input.area &&
            order.urgent === input.urgent &&
            JSON.stringify(
              order.extras
                .map((e) => ({ id: e.extraId, q: Number(e.quantity) }))
                .sort((a, b) => a.id.localeCompare(b.id)),
            ) ===
              JSON.stringify(
                (
                  await tx.serviceExtra.findMany({
                    where: {
                      code: {
                        in: input.extras
                          .filter((e) => e.quantity > 0)
                          .map((e) => e.code),
                      },
                    },
                    select: { id: true, code: true },
                  })
                )
                  .map((e) => ({
                    id: e.id,
                    q: input.extras.find((x) => x.code === e.code)!.quantity,
                  }))
                  .sort((a, b) => a.id.localeCompare(b.id)),
              );
          const priced = sameScope
            ? {
                ...priceSnapshot(
                  Number(order.basePrice ?? 0),
                  Number(order.discountPercent),
                  input.finalPrice ?? null,
                  input.priceChangeReason,
                ),
                serviceId: order.serviceId,
              }
            : (await orderData(tx, input, Number(order.discountPercent))).data;
          const sameDurationScope =
            sameScope &&
            order.soilLevel === input.soilLevel &&
            order.requiredCleaners === input.requiredCleaners;
          const nextDuration = sameDurationScope
            ? null
            : await durationData(tx, {
                serviceId: priced.serviceId,
                area: input.area,
                soilLevel: input.soilLevel,
                requiredCleaners: input.requiredCleaners,
                extras: input.extras,
              });
          const data = {
            ...priced,
            ...schedule(input),
            ...(update.addressId ? { addressId: update.addressId } : {}),
            soilLevel: input.soilLevel,
            manualDurationMinutes: input.manualDurationMinutes ?? null,
            requiredCleaners: input.requiredCleaners,
            clientComment: input.clientComment,
            internalComment: input.internalComment,
            ...(sameDurationScope
              ? {
                  estimatedDurationMinutes: order.estimatedDurationMinutes,
                  cleaningReserveMinutes: order.cleaningReserveMinutes,
                  durationRuleId: order.durationRuleId,
                  durationRuleVersion: order.durationRuleVersion,
                }
              : nextDuration!),
          };
          const reason = overrideReason(
            data.manualDurationMinutes,
            data.estimatedDurationMinutes,
            input.durationOverrideReason,
            order,
          );
          // Clear an obsolete snapshot only after an actual input change. Rule edits alone never rewrite orders.
          const durationSnapshot = sameDurationScope
            ? undefined
            : nextDuration!.durationSnapshot;
          if (
            input.scheduleMode === "FLEXIBLE" &&
            order.scheduleMode === "FLEXIBLE"
          )
            data.scheduledStart = input.scheduledStart
              ? localInstant(input.scheduledStart)
              : order.scheduledStart;
          const planChanged = [
            "scheduleMode",
            "scheduledStart",
            "windowFrom",
            "windowTo",
            "manualDurationMinutes",
            "requiredCleaners",
            "addressId",
            "estimatedDurationMinutes",
            "cleaningReserveMinutes",
          ].some(
            (key) =>
              String(order[key as keyof typeof order]) !==
              String(data[key as keyof typeof data]),
          );
          if (planChanged) {
            const assignments = await tx.orderCleaner.findMany({
              where: { orderId: order.id, removedAt: null },
              select: { cleanerId: true },
            });
            const cleanerIds = assignments.map((a) => a.cleanerId);
            if (
              cleanerIds.length ||
              (data.scheduleMode === "FLEXIBLE" && data.scheduledStart)
            ) {
              await lockCrew(tx, cleanerIds);
              await enforceScheduling(
                tx,
                { ...order, ...data, cleanerIds },
                userId,
                update,
              );
            }
          }
          const changes: AuditChanges = {
            changedFields: { before: null, after: changedFields(order, data) },
          };
          if (!sameScope)
            changes.changedFields!.after = [
              ...(changes.changedFields!.after as string[]),
              "extras",
            ];
          for (const key of [
            "status",
            "scheduledStart",
            "windowFrom",
            "windowTo",
            "scheduleMode",
            "finalPrice",
            "basePrice",
            "discountAmount",
            "priceAdjustment",
            "manualDurationMinutes",
          ] as const) {
            if (
              key in data &&
              String(order[key]) !== String(data[key as keyof typeof data])
            )
              changes[key] = {
                before:
                  order[key] instanceof Date
                    ? (order[key] as Date).toISOString()
                    : (order[key]?.toString() ?? null),
                after:
                  data[key as keyof typeof data] instanceof Date
                    ? (data[key as keyof typeof data] as Date).toISOString()
                    : (data[key as keyof typeof data]?.toString() ?? null),
              };
          }
          await tx.order.update({
            where: { id: order.id },
            data: { ...data, durationOverrideReason: reason, durationSnapshot },
          });
          if (!sameScope) {
            const result = await orderData(
              tx,
              input,
              Number(order.discountPercent),
            );
            await tx.orderExtra.deleteMany({ where: { orderId: order.id } });
            await tx.orderExtra.createMany({
              data: result.extras.map((e) => ({ ...e, orderId: order.id })),
            });
          }
          await audit("ORDER_UPDATED", "Order", order.id, changes);
          if (changes.manualDurationMinutes)
            await audit("ORDER_DURATION_CHANGED", "Order", order.id, {
              manualDurationMinutes: changes.manualDurationMinutes,
            });
          if (
            changes.scheduledStart ||
            changes.windowFrom ||
            changes.windowTo ||
            changes.scheduleMode
          )
            await audit("ORDER_RESCHEDULED", "Order", order.id, changes);
          if (changes.finalPrice || changes.basePrice)
            await audit("ORDER_PRICE_CHANGED", "Order", order.id, {
              finalPrice: changes.finalPrice,
              basePrice: changes.basePrice,
              discountAmount: changes.discountAmount,
              priceAdjustment: changes.priceAdjustment,
            });
        }
        const notified=await tx.order.findUniqueOrThrow({where:{id:order.id}});
        await orderNotifications(tx,order.id,notified.status==='CANCELLED'?'CANCELLED':'CHANGED',`crm:${order.id}:${notified.updatedAt.toISOString()}`);
        return { id: order.id };
      }
      throw new CrmError("VALIDATION", "Команда не найдена");
    },
    { maxWait: 10000, timeout: 30000 },
  );
}
