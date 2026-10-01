import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { runFinanceCommand } from "../../src/lib/services/finance-commands";
import { runCrmCommand } from "../../src/lib/services/crm-commands";
import { completeEconomics } from "../../src/lib/services/payout-calculation";
import {
  previewLegacy,
  applyLegacy,
} from "../../src/lib/services/legacy-import";
import { periodTotals } from "../../src/lib/services/finance-calculation";
import { financePeriod } from "../../src/lib/domain/finance";
import { localInstant } from "../../src/lib/domain/crm";
import { SchedulingError } from "../../src/lib/domain/scheduling-types";
import { legacyFixture } from "./fixtures";
const url = process.env.ADMIN_TEST_DATABASE_URL;
test(
  "duration, finance and import commands stay transactional",
  { skip: !url },
  async (t) => {
    assert.equal(new URL(url!).hostname, "127.0.0.1");
    assert.equal(new URL(url!).pathname, "/lumaclean_admin_test");
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: url!, max: 5 }),
    });
    const password = randomUUID() + "Aa!7",
      email = "finance-" + randomUUID() + "@example.test",
      uid = randomUUID();
    const owner = await db.user.create({
      data: {
        id: uid,
        name: "Финансы · локальный тест",
        email,
        emailVerified: true,
        role: "ADMIN",
        accounts: {
          create: {
            providerId: "credential",
            accountId: uid,
            password: await hashPassword(password),
          },
        },
      },
    });
    const cleaner = await db.cleaner.create({
        data: {
          name: "Клинер А · local",
          phone: "0641234567",
          languages: [],
          skills: [],
          payoutPercent: 25,
        },
      }),
      partner = await db.cleaner.create({
        data: {
          name: "Клинер Б · local",
          phone: "0642345678",
          languages: [],
          skills: [],
        },
      });
    const client = await db.client.create({
        data: { name: "Клиент · local", phone: "0643456789" },
      }),
      address = await db.clientAddress.create({
        data: {
          clientId: client.id,
          fullAddress: "Локальный тестовый адрес, Белград",
        },
      });
    const defaults = {
      service: "regular",
      previousId: null,
      active: true,
      minArea: 1,
      maxArea: 100,
      referenceArea: 100,
      cleanerCount: 2,
      baseMinutes: 150,
      minutesPerSquare: 0,
      reserveMinutes: 0,
      soilMultipliers: { LIGHT: 0.8, NORMAL: 1, HEAVY: 1.5, EXTREME: 2 },
      extraMinutes: { fridge: 20 },
      notes: "Ориентир владельца · тест",
    };
    const input = {
      service: "regular",
      area: 70,
      soilLevel: "NORMAL",
      urgent: false,
      extras: [],
      requiredCleaners: 2,
      manualDurationMinutes: null,
      finalPrice: 10000,
      priceChangeReason: "Локальный тест цены",
      scheduleMode: "FIXED",
      scheduledStart: "2026-10-04T10:00",
      windowFrom: null,
      windowTo: null,
      clientComment: null,
      internalComment: "Локальный тест",
    };
    const create = (patch: Record<string, unknown> = {}) =>
      runCrmCommand(db, owner.id, "order-create", {
        clientId: client.id,
        addressId: address.id,
        requestId: randomUUID(),
        order: { ...input, ...patch },
      });
    let first: { id: string },
      ruleId = "";
    try {
      await t.test(
        "new rule versions retain old order snapshot; no automatic rule recalculation",
        async () => {
          ruleId = (
            (await runFinanceCommand(
              db,
              owner.id,
              "duration-rule",
              defaults,
            )) as { id: string }
          ).id;
          first = await create();
          const old = await db.order.findUniqueOrThrow({
            where: { id: first.id },
          });
          assert.equal(old.estimatedDurationMinutes, 150);
          assert.equal(old.durationRuleVersion, 1);
          const next = await runFinanceCommand(db, owner.id, "duration-rule", {
            ...defaults,
            previousId: ruleId,
            baseMinutes: 180,
          });
          assert(next);
          assert.equal(
            (await db.order.findUniqueOrThrow({ where: { id: first.id } }))
              .estimatedDurationMinutes,
            150,
          );
          await runCrmCommand(db, owner.id, "order-update", {
            id: first.id,
            order: { ...input, internalComment: "Только комментарий" },
          });
          const unchanged = await db.order.findUniqueOrThrow({
            where: { id: first.id },
          });
          assert.equal(unchanged.durationRuleVersion, 1);
          assert.deepEqual(unchanged.durationSnapshot, old.durationSnapshot);
          assert.equal(
            (
              await db.order.findUniqueOrThrow({
                where: { id: (await create()).id },
              })
            ).estimatedDurationMinutes,
            180,
          );
          await assert.rejects(
            db.durationRule.update({
              where: { id: ruleId },
              data: { baseMinutes: 999 },
            }),
          );
        },
      );
      await t.test(
        "manual duration override and audit reason are required",
        async () => {
          await assert.rejects(create({ manualDurationMinutes: 200 }));
          const o = await create({
            manualDurationMinutes: 200,
            durationOverrideReason: "Дополнительное загрязнение",
          });
          const saved = await db.order.findUniqueOrThrow({
            where: { id: o.id },
          });
          assert.equal(saved.estimatedDurationMinutes, 180);
          assert.equal(saved.manualDurationMinutes, 200);
          assert(saved.durationOverrideReason);
          assert.equal(
            await db.auditLog.count({
              where: { entityId: o.id, action: "ORDER_DURATION_OVERRIDDEN" },
            }),
            1,
          );
        },
      );
      await t.test(
        "service/area/soil/cleaner changes recalculate; unsupported count needs manual plan",
        async () => {
          const o = await create();
          await runCrmCommand(db, owner.id, "order-update", {
            id: o.id,
            order: {
              ...input,
              soilLevel: "HEAVY",
              extras: [{ code: "fridge", quantity: 1 }],
            },
          });
          assert.equal(
            (await db.order.findUniqueOrThrow({ where: { id: o.id } }))
              .estimatedDurationMinutes,
            290,
          );
          await runCrmCommand(db, owner.id, "order-update", {
            id: o.id,
            order: { ...input, requiredCleaners: 1 },
          });
          const r = await db.order.findUniqueOrThrow({ where: { id: o.id } });
          assert.equal(r.estimatedDurationMinutes, null);
          assert.equal(r.durationSnapshot, null);
        },
      );
      await t.test(
        "changed duration conflicting with following job rolls back",
        async () => {
          const before = await db.order.findUniqueOrThrow({
            where: { id: first.id },
          });
          for (let weekday = 1; weekday <= 7; weekday++)
            await db.cleanerAvailability.create({
              data: {
                cleanerId: cleaner.id,
                kind: "WEEKLY",
                weekday,
                startMinute: 0,
                endMinute: 1440,
              },
            });
          await db.orderCleaner.create({
            data: { orderId: first.id, cleanerId: cleaner.id },
          });
          const next = await create({ scheduledStart: "2026-10-04T12:45" });
          await db.orderCleaner.create({
            data: { orderId: next.id, cleanerId: cleaner.id },
          });
          await assert.rejects(
            runCrmCommand(db, owner.id, "order-update", {
              id: first.id,
              order: { ...input, soilLevel: "HEAVY" },
            }),
            (e) =>
              e instanceof SchedulingError &&
              e.issues.some((i) => i.severity === "ERROR"),
          );
          const after = await db.order.findUniqueOrThrow({
            where: { id: first.id },
          });
          assert.equal(
            after.estimatedDurationMinutes,
            before.estimatedDurationMinutes,
          );
          assert.equal(after.soilLevel, before.soilLevel);
          await db.orderCleaner.updateMany({
            where: { orderId: first.id },
            data: { removedAt: new Date() },
          });
          await db.orderCleaner.updateMany({
            where: { orderId: next.id },
            data: { removedAt: new Date() },
          });
        },
      );
      let payoutId = "",
        completedId = "";
      await t.test(
        "completion calculates independent cleaner snapshot; missing percent does not block",
        async () => {
          const o = await create({ scheduledStart: "2026-09-30T10:00" });
          completedId = o.id;
          await db.order.update({
            where: { id: o.id },
            data: { status: "IN_PROGRESS" },
          });
          await db.orderCleaner.createMany({
            data: [cleaner, partner].map((c) => ({
              orderId: o.id,
              cleanerId: c.id,
              startedAt: localInstant("2026-09-30T10:00"),
              finishedAt: localInstant("2026-09-30T12:30"),
            })),
          });
          await runCrmCommand(db, owner.id, "order-status", {
            id: o.id,
            status: "COMPLETED",
          });
          const payouts = await db.cleanerPayout.findMany({
            where: { orderId: o.id },
          });
          assert.equal(payouts.length, 1);
          assert.equal(Number(payouts[0].amount), 2500);
          assert.equal(Number(payouts[0].basisAmount), 10000);
          payoutId = payouts[0].id;
          assert.equal(
            (await db.order.findUniqueOrThrow({ where: { id: o.id } }))
              .actualDurationMinutes,
            150,
          );
          await db.$transaction((tx) => completeEconomics(tx, o.id, owner.id));
          assert.equal(
            await db.cleanerPayout.count({ where: { orderId: o.id } }),
            1,
          );
          await runFinanceCommand(db, owner.id, "settings", {
            defaultCleanerPayoutPercent: 15,
          });
          await runFinanceCommand(db, owner.id, "payout-create-missing", {
            orderId: o.id,
            reason: "Условия партнёра согласованы",
          });
          const b = await db.cleanerPayout.findUniqueOrThrow({
            where: {
              orderId_cleanerId: { orderId: o.id, cleanerId: partner.id },
            },
          });
          assert.equal(Number(b.amount), 1500);
          assert.equal(
            Number(
              (
                await db.cleanerPayout.findUniqueOrThrow({
                  where: { id: payoutId },
                })
              ).amount,
            ),
            2500,
          );
        },
      );
      await t.test(
        "completed order price correction and new percentages do not rewrite payouts",
        async () => {
          await db.cleaner.update({
            where: { id: cleaner.id },
            data: { payoutPercent: 50 },
          });
          const o = await db.order.findUniqueOrThrow({
            where: { id: completedId },
          });
          await runFinanceCommand(db, owner.id, "order-price", {
            id: o.id,
            expectedUpdatedAt: o.updatedAt.toISOString(),
            finalPrice: 12000,
            reason: "Уточнение завершённой цены",
          });
          assert.equal(
            Number(
              (
                await db.cleanerPayout.findUniqueOrThrow({
                  where: { id: payoutId },
                })
              ).amount,
            ),
            2500,
          );
        },
      );
      await t.test(
        "expense CRUD, linked payout exclusion and actual period aggregates",
        async () => {
          const date = financePeriod({}).fromLabel;
          const created = (await runFinanceCommand(
            db,
            owner.id,
            "expense-create",
            {
              date,
              category: "MARKETING",
              amount: 600,
              description: "Реклама · local",
              orderId: completedId,
            },
          )) as { id: string };
          await db.expense.create({
            data: {
              occurredAt: new Date(),
              category: "PAYOUT",
              amount: 2500,
              payoutId,
              description: "Старая связанная модель",
            },
          });
          let totals = await db.$transaction((tx) =>
            periodTotals(tx, financePeriod({})),
          );
          assert.equal(totals.revenue, 12000);
          assert.equal(totals.expenses, 600);
          assert.equal(totals.accrued, 4000);
          assert.equal(totals.orderCount, 1);
          assert.equal(totals.average, 12000);
          const e = await db.expense.findUniqueOrThrow({
            where: { id: created.id },
          });
          await runFinanceCommand(db, owner.id, "expense-update", {
            id: e.id,
            expectedUpdatedAt: e.updatedAt.toISOString(),
            date,
            category: "SOFTWARE",
            amount: 650,
            description: "Сервисы · local",
            orderId: completedId,
          });
          const next = await db.expense.findUniqueOrThrow({
            where: { id: e.id },
          });
          await runFinanceCommand(db, owner.id, "expense-delete", {
            id: e.id,
            expectedUpdatedAt: next.updatedAt.toISOString(),
            reason: "Дублирующая запись теста",
          });
          totals = await db.$transaction((tx) =>
            periodTotals(tx, financePeriod({})),
          );
          assert.equal(totals.expenses, 0);
          assert(
            (await db.expense.findUniqueOrThrow({ where: { id: e.id } }))
              .deletionReason,
          );
          await runFinanceCommand(db, owner.id, "expense-create", {
            date,
            category: "SOFTWARE",
            amount: 600,
            description: "Сервис · проверка интерфейса",
            orderId: completedId,
          });
          assert.equal(
            (
              await db.$transaction((tx) =>
                periodTotals(tx, financePeriod({ period: "previous" })),
              )
            ).revenue,
            0,
          );
        },
      );
      await t.test(
        "payout payment and conscious adjustment use optimistic version and audit",
        async () => {
          let p = await db.cleanerPayout.findUniqueOrThrow({
            where: { id: payoutId },
          });
          const stale = p.updatedAt.toISOString();
          await runFinanceCommand(db, owner.id, "payout-recalculate", {
            id: p.id,
            expectedUpdatedAt: stale,
            reason: "Осознанный пересчёт по новым условиям",
          });
          p = await db.cleanerPayout.findUniqueOrThrow({ where: { id: p.id } });
          assert.equal(Number(p.amount), 6000);
          assert.equal(Number(p.appliedPercent), 50);
          await assert.rejects(
            runFinanceCommand(db, owner.id, "payout-pay", {
              id: p.id,
              expectedUpdatedAt: stale,
            }),
          );
          await runFinanceCommand(db, owner.id, "payout-pay", {
            id: p.id,
            expectedUpdatedAt: p.updatedAt.toISOString(),
          });
          p = await db.cleanerPayout.findUniqueOrThrow({ where: { id: p.id } });
          assert.equal(p.status, "PAID");
          assert(p.paidAt);
          assert(
            await db.auditLog.count({
              where: { entityId: p.id, action: "PAYOUT_PAY" },
            }),
          );
        },
      );
      await t.test(
        "unset percentage still completes an order without payouts",
        async () => {
          await runFinanceCommand(db, owner.id, "settings", {
            defaultCleanerPayoutPercent: null,
          });
          const o = await create({ finalPrice: 500 });
          await db.order.update({
            where: { id: o.id },
            data: { status: "IN_PROGRESS" },
          });
          await db.orderCleaner.create({
            data: { orderId: o.id, cleanerId: partner.id },
          });
          await runCrmCommand(db, owner.id, "order-status", {
            id: o.id,
            status: "COMPLETED",
          });
          assert.equal(
            await db.cleanerPayout.count({ where: { orderId: o.id } }),
            0,
          );
        },
      );
      const bytes = Buffer.from(await legacyFixture().xlsx.writeBuffer());
      let batchId = "";
      await t.test(
        "preview makes no operational writes; repeated clients merge on apply",
        async () => {
          const before = await db.order.count();
          const p = await previewLegacy(db, owner.id, bytes, "fixture.xlsx");
          batchId = p.batchId;
          assert.equal(await db.order.count(), before);
          const result = await applyLegacy(db, owner.id, {
            batchId,
            selected: p.rows.map((r) => r.sourceKey),
            acknowledgeWarnings: true,
            reason: "Проверены локальные тестовые строки",
          });
          assert.equal(result.clients, 1);
          assert.equal(result.orders, 2);
          assert.equal(result.expenses, 1);
          assert.equal(result.addresses, 1);
          assert.equal(
            await db.cleanerPayout.count({
              where: { order: { historical: true } },
            }),
            0,
          );
        },
      );
      await t.test(
        "re-export and repeated import are idempotent, changed sources never overwrite",
        async () => {
          const p = await previewLegacy(
            db,
            owner.id,
            bytes,
            "same-file-new-name.xlsx",
          );
          assert.equal(p.batchId, batchId);
          const result = await applyLegacy(db, owner.id, {
            batchId,
            selected: p.rows.map((r) => r.sourceKey),
            acknowledgeWarnings: true,
            reason: "Повторный локальный импорт",
          });
          assert.equal(result.orders, 0);
          assert.equal(result.skipped, 3);
          const changed = legacyFixture();
          changed.getWorksheet("Заказы")!.getCell(5, 7).value = 9999;
          const diff = await previewLegacy(
            db,
            owner.id,
            Buffer.from(await changed.xlsx.writeBuffer()),
            "changed.xlsx",
          );
          assert(
            diff.rows[0].errors.some((e) => e.includes("источник изменился")),
          );
          await assert.rejects(
            applyLegacy(db, owner.id, {
              batchId: diff.batchId,
              selected: [diff.rows[0].sourceKey],
              acknowledgeWarnings: true,
              reason: "Изменённый источник",
            }),
          );
        },
      );
      await t.test(
        "one linked expense error rolls back all previously created rows and audits",
        async () => {
          const b = legacyFixture();
          b.getWorksheet("Заказы")!.getCell(5, 2).value = "rollback-5";
          b.getWorksheet("Заказы")!.getCell(6, 2).value = "rollback-6";
          b.getWorksheet("Расходы")!.getCell(5, 2).value = "rollback-expense";
          b.getWorksheet("Расходы")!.getCell(5, 3).value = "missing-order";
          const p = await previewLegacy(
              db,
              owner.id,
              Buffer.from(await b.xlsx.writeBuffer()),
              "rollback.xlsx",
            ),
            before = await db.order.count(),
            audits = await db.auditLog.count();
          await assert.rejects(
            applyLegacy(db, owner.id, {
              batchId: p.batchId,
              selected: p.rows.map((r) => r.sourceKey),
              acknowledgeWarnings: true,
              reason: "Проверка атомарности транзакции",
            }),
          );
          assert.equal(await db.order.count(), before);
          assert.equal(await db.auditLog.count(), audits);
          assert.equal(
            await db.importRecord.count({
              where: { sourceKey: { contains: "rollback" } },
            }),
            0,
          );
        },
      );
      await t.test(
        "owner binding and expired previews reject apply",
        async () => {
          const p = await previewLegacy(db, owner.id, bytes, "fixture.xlsx");
          await db.importBatch.update({
            where: { id: p.batchId },
            data: { expiresAt: new Date(0) },
          });
          await assert.rejects(
            applyLegacy(db, owner.id, {
              batchId: p.batchId,
              selected: p.rows.map((r) => r.sourceKey),
              acknowledgeWarnings: true,
              reason: "Проверка истечения срока",
            }),
          );
          const other = await db.user.create({
            data: {
              name: "Другой local admin",
              email: randomUUID() + "@example.test",
              role: "ADMIN",
            },
          });
          await assert.rejects(
            applyLegacy(db, other.id, {
              batchId: p.batchId,
              selected: p.rows.map((r) => r.sourceKey),
              acknowledgeWarnings: true,
              reason: "Чужой preview",
            }),
          );
        },
      );
      await t.test("revoked administrator cannot write finances", async () => {
        const c = await db.user.create({
          data: {
            name: "Клинер local",
            email: randomUUID() + "@example.test",
            role: "CLEANER",
          },
        });
        await assert.rejects(
          runFinanceCommand(db, c.id, "settings", {
            defaultCleanerPayoutPercent: 99,
          }),
        );
      });
      if (process.env.ADMIN_TEST_BROWSER_FIXTURE === "1")
        writeFileSync(
          "artifacts/admin/finance-fixture.json",
          JSON.stringify({
            email,
            password,
            ownerId: owner.id,
            orderId: completedId,
            cleanerId: cleaner.id,
            addressId: address.id,
            clientId: client.id,
            ruleId,
          }),
        );
    } finally {
      await db.$disconnect();
    }
  },
);
