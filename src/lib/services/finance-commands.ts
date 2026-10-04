import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { financeSchemas, type FinanceCommand } from "@/lib/validation/finance";
import { CrmError, localInstant } from "@/lib/domain/crm";
import { payoutSnapshot } from "@/lib/domain/finance";
import { actualDuration } from "@/lib/domain/duration";
import { writeAudit, type AuditChanges } from "./audit";
import { completeEconomics } from "./payout-calculation";
import { durationEstimate } from "./duration-engine";
async function lock(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))::text`;
}
function fresh(actual: Date, expected: string) {
  if (actual.toISOString() !== expected)
    throw new CrmError("STALE", "Запись изменилась. Обновите страницу.");
}
export async function runFinanceCommand(
  db: PrismaClient,
  userId: string,
  command: FinanceCommand,
  payload: unknown,
) {
  financeSchemas[command].parse(payload);
  return db.$transaction(
    async (tx) => {
      if (
        !(await tx.user.count({
          where: { id: userId, active: true, role: "ADMIN" },
        }))
      )
        throw new CrmError("FORBIDDEN", "Недостаточно прав");
      await lock(tx, "finance:commands");
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
      if (command === "duration-estimate") {
        const v = financeSchemas[command].parse(payload),
          service = await tx.service.findUniqueOrThrow({
            where: { code: v.service },
          });
        return durationEstimate(tx, { ...v, serviceId: service.id });
      }
      if (command === "settings") {
        const v = financeSchemas[command].parse(payload),
          old = await tx.businessSettings.findUniqueOrThrow({
            where: { id: "default" },
          });
        await tx.businessSettings.update({ where: { id: "default" }, data: v });
        await audit("PAYOUT_DEFAULT_UPDATED", "BusinessSettings", "default", {
          appliedPercent: {
            before: old.defaultCleanerPayoutPercent?.toString() ?? null,
            after:
              v.defaultCleanerPayoutPercent === null
                ? null
                : String(v.defaultCleanerPayoutPercent),
          },
        });
        return { id: "default" };
      }
      if (command === "duration-rule") {
        const v = financeSchemas[command].parse(payload),
          service = await tx.service.findUniqueOrThrow({
            where: { code: v.service },
          });
        await lock(tx, "duration:" + service.id);
        const previous = v.previousId
          ? await tx.durationRule.findUnique({ where: { id: v.previousId } })
          : null;
        if (v.previousId && previous?.serviceId !== service.id)
          throw new CrmError(
            "VALIDATION",
            "Выберите предыдущее правило той же услуги.",
          );
        if (
          v.active &&
          (await tx.durationRule.count({
            where: {
              serviceId: service.id,
              active: true,
              cleanerCount: v.cleanerCount,
              ...(v.previousId ? { id: { not: v.previousId } } : {}),
              AND: [
                { OR: [{ minArea: null }, { minArea: { lte: v.maxArea } }] },
                { OR: [{ maxArea: null }, { maxArea: { gte: v.minArea } }] },
              ],
            },
          }))
        )
          throw new CrmError(
            "VALIDATION",
            "Активные диапазоны площади пересекаются.",
          );
        const max = await tx.durationRule.aggregate({
          where: { serviceId: service.id },
          _max: { version: true },
        });
        const { service: _, previousId: __, ...data } = v;
        void _;
        void __;
        if (previous && v.active)
          await tx.durationRule.update({
            where: { id: previous.id },
            data: { active: false },
          });
        const rule = await tx.durationRule.create({
          data: {
            ...data,
            serviceId: service.id,
            version: (max._max.version ?? 0) + 1,
          },
        });
        if (previous && v.active)
          await audit("DURATION_RULE_DEACTIVATED", "DurationRule", previous.id);
        await audit("DURATION_RULE_CREATED", "DurationRule", rule.id, {
          version: { before: null, after: String(rule.version) },
          active: { before: null, after: rule.active },
        });
        return { id: rule.id };
      }
      if (command === "duration-active") {
        const v = financeSchemas[command].parse(payload),
          r = await tx.durationRule.findUniqueOrThrow({ where: { id: v.id } });
        await lock(tx, "duration:" + r.serviceId);
        if (
          v.active &&
          (!r.baseMinutes ||
            (await tx.durationRule.count({
              where: {
                serviceId: r.serviceId,
                id: { not: r.id },
                active: true,
                cleanerCount: r.cleanerCount,
                AND: [
                  {
                    OR: [
                      { minArea: null },
                      { minArea: { lte: r.maxArea ?? 10000 } },
                    ],
                  },
                  {
                    OR: [
                      { maxArea: null },
                      { maxArea: { gte: r.minArea ?? 0 } },
                    ],
                  },
                ],
              },
            })))
        )
          throw new CrmError(
            "VALIDATION",
            "Правило неполное или диапазон пересекается.",
          );
        await tx.durationRule.update({
          where: { id: r.id },
          data: { active: v.active },
        });
        await audit("DURATION_RULE_ACTIVITY_CHANGED", "DurationRule", r.id, {
          active: { before: r.active, after: v.active },
        });
        return { id: r.id };
      }
      if (command.startsWith("expense-")) {
        if (command === "expense-delete") {
          const v = financeSchemas[command].parse(payload),
            r = await tx.expense.findUniqueOrThrow({ where: { id: v.id } });
          fresh(r.updatedAt, v.expectedUpdatedAt);
          if (r.payoutId)
            throw new CrmError(
              "VALIDATION",
              "Связанная выплата редактируется в разделе выплат.",
            );
          // Keep historical import records and meaningful deletion reasons.
          await audit("EXPENSE_DELETED", "Expense", r.id, {
            amount: { before: r.amount.toString(), after: null },
          });
          await tx.expense.update({
            where: { id: r.id },
            data: { deletedAt: new Date(), deletionReason: v.reason },
          });
          return { id: r.id };
        }
        const v = expenseInputFor(command, payload);
        if (v.orderId && !(await tx.order.count({ where: { id: v.orderId } })))
          throw new CrmError("NOT_FOUND", "Заказ не найден.");
        const { date, ...data } = v;
        const old =
          command === "expense-update"
            ? await tx.expense.findUniqueOrThrow({
                where: { id: financeSchemas[command].parse(payload).id },
              })
            : null;
        if (old) {
          fresh(
            old.updatedAt,
            financeSchemas["expense-update"].parse(payload).expectedUpdatedAt,
          );
          if (old.payoutId)
            throw new CrmError(
              "VALIDATION",
              "Связанная выплата редактируется отдельно.",
            );
        }
        const r = old
          ? await tx.expense.update({
              where: { id: old.id },
              data: { ...data, occurredAt: localInstant(date + "T12:00") },
            })
          : await tx.expense.create({
              data: { ...data, occurredAt: localInstant(date + "T12:00") },
            });
        await audit(
          old ? "EXPENSE_UPDATED" : "EXPENSE_CREATED",
          "Expense",
          r.id,
          {
            amount: {
              before: old?.amount.toString() ?? null,
              after: r.amount.toString(),
            },
            changedFields: {
              before: null,
              after: ["date", "category", "amount", "description", "orderId"],
            },
          },
        );
        return { id: r.id };
      }
      if (command === "assignment-time") {
        const v = financeSchemas[command].parse(payload);
        await lock(tx, "order:" + v.orderId);
        const a = await tx.orderCleaner.findFirst({
          where: { id: v.id, orderId: v.orderId, removedAt: null },
        });
        if (!a) throw new CrmError("NOT_FOUND", "Назначение не найдено.");
        const startedAt = localInstant(v.startedAt),
          finishedAt = localInstant(v.finishedAt);
        if (
          finishedAt <= startedAt ||
          finishedAt.getTime() - startedAt.getTime() > 86400000 ||
          finishedAt > new Date()
        )
          throw new CrmError(
            "VALIDATION",
            "Фактическое время должно быть в прошлом; длительность — до суток.",
          );
        await tx.orderCleaner.update({
          where: { id: v.id },
          data: { startedAt, finishedAt, notes: v.reason },
        });
        const order = await tx.order.findUniqueOrThrow({
          where: { id: v.orderId },
        });
        if (order.status === "COMPLETED") {
          const actual = actualDuration(
            await tx.orderCleaner.findMany({
              where: { orderId: order.id, removedAt: null },
            }),
          );
          await tx.order.update({
            where: { id: order.id },
            data: { actualDurationMinutes: actual },
          });
          await audit("ORDER_ACTUAL_DURATION_UPDATED", "Order", order.id, {
            actualDurationMinutes: {
              before:
                order.actualDurationMinutes === null
                  ? null
                  : String(order.actualDurationMinutes),
              after: actual === null ? null : String(actual),
            },
          });
        }
        await audit("ASSIGNMENT_TIME_UPDATED", "Order", v.orderId, {
          changedFields: { before: null, after: ["startedAt", "finishedAt"] },
        });
        return { id: v.orderId };
      }
      if (command === "order-price") {
        const v = financeSchemas[command].parse(payload);
        await lock(tx, "order:" + v.id);
        const o = await tx.order.findUniqueOrThrow({ where: { id: v.id } });
        fresh(o.updatedAt, v.expectedUpdatedAt);
        if (o.status !== "COMPLETED")
          throw new CrmError(
            "VALIDATION",
            "Операция предназначена для завершённого заказа.",
          );
        await tx.order.update({
          where: { id: v.id },
          data: {
            finalPrice: v.finalPrice,
            priceAdjustment:
              v.finalPrice -
              Number(o.basePrice ?? 0) +
              Number(o.discountAmount),
            priceChangeReason: v.reason,
          },
        });
        await audit("COMPLETED_ORDER_PRICE_CORRECTED", "Order", o.id, {
          finalPrice: {
            before: o.finalPrice?.toString() ?? null,
            after: String(v.finalPrice),
          },
        });
        return { id: o.id };
      }
      if (command === "payout-create-missing") {
        const v = financeSchemas[command].parse(payload);
        await lock(tx, "order:" + v.orderId);
        await completeEconomics(tx, v.orderId, userId);
        await audit("PAYOUT_MISSING_REQUESTED", "Order", v.orderId);
        return { id: v.orderId };
      }
      const v = financeSchemas[command].parse(payload) as {
        id: string;
        expectedUpdatedAt: string;
        reason?: string;
        amount?: number;
      };
      const p = await tx.cleanerPayout.findUniqueOrThrow({
        where: { id: v.id },
      });
      await lock(tx, "order:" + p.orderId);
      const current = await tx.cleanerPayout.findUniqueOrThrow({
        where: { id: v.id },
      });
      fresh(current.updatedAt, v.expectedUpdatedAt);
      let data: Prisma.CleanerPayoutUpdateInput = {};
      if (command === "payout-pay") {
        if (current.status !== "PENDING")
          throw new CrmError("VALIDATION", "Выплата уже закрыта.");
        data = { status: "PAID", paidAt: new Date() };
      } else if (command === "payout-cancel")
        data = { status: "CANCELLED", adjustmentReason: v.reason };
      else if (command === "payout-adjust")
        data = { amount: v.amount, adjustmentReason: v.reason };
      else if (command === "payout-recalculate") {
        if (current.status !== "PENDING")
          throw new CrmError(
            "VALIDATION",
            "Пересчёт доступен только для ожидающей выплаты.",
          );
        const o = await tx.order.findUniqueOrThrow({
            where: { id: p.orderId },
          }),
          c = await tx.cleaner.findUniqueOrThrow({
            where: { id: p.cleanerId },
          }),
          s = await tx.businessSettings.findUniqueOrThrow({
            where: { id: "default" },
          });
        const next = payoutSnapshot(
          Number(o.finalPrice),
          c.payoutPercent === null ? null : Number(c.payoutPercent),
          s.defaultCleanerPayoutPercent === null
            ? null
            : Number(s.defaultCleanerPayoutPercent),
        );
        if (!next)
          throw new CrmError("VALIDATION", "Процент выплаты не настроен.");
        data = { ...next, adjustmentReason: v.reason };
      } else throw new CrmError("VALIDATION", "Неизвестная команда.");
      const next = await tx.cleanerPayout.update({ where: { id: p.id }, data });
      await audit(
        command.toUpperCase().replaceAll("-", "_"),
        "CleanerPayout",
        p.id,
        {
          amount: {
            before: current.amount.toString(),
            after: next.amount.toString(),
          },
          appliedPercent: {
            before: current.appliedPercent.toString(),
            after: next.appliedPercent.toString(),
          },
          basisAmount: {
            before: current.basisAmount.toString(),
            after: next.basisAmount.toString(),
          },
          status: { before: current.status, after: next.status },
        },
      );
      return { id: p.id };
    },
    { timeout: 30000, maxWait: 10000 },
  );
}
function expenseInputFor(command: FinanceCommand, payload: unknown) {
  return financeSchemas["expense-create"].parse(
    command === "expense-update"
      ? (({ id, expectedUpdatedAt, ...v }) => {
          void id;
          void expectedUpdatedAt;
          return v;
        })(financeSchemas["expense-update"].parse(payload))
      : payload,
  );
}
