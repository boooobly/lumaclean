import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { runSchedulingCommand } from "../../src/lib/services/scheduling-commands";
import { runCrmCommand } from "../../src/lib/services/crm-commands";
import { localInstant, localInput } from "../../src/lib/domain/crm";
import { SchedulingError } from "../../src/lib/domain/scheduling-types";
const dbUrl = process.env.ADMIN_TEST_DATABASE_URL,
  base = process.env.ADMIN_TEST_BASE_URL;
test(
  "scheduling transactions, concurrency and authenticated calendar",
  { skip: !dbUrl || !base },
  async (t) => {
    const url = new URL(dbUrl!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/lumaclean_admin_test");
    assert.equal(new URL(base!).hostname, "localhost");
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: dbUrl!, max: 8 }),
    });
    const uid = randomUUID(),
      password = randomUUID() + "Aa!7",
      email = `schedule-${uid}@example.test`;
    await db.user.create({
      data: {
        id: uid,
        name: "Проверка планирования",
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
    const execute = (
      command: Parameters<typeof runSchedulingCommand>[2],
      payload: unknown,
    ) => runSchedulingCommand(db, uid, command, payload);
    const client = await db.client.create({
        data: {
          name: "Планирование · локальная проверка",
          phone: "0641234567",
        },
      }),
      address = await db.clientAddress.create({
        data: {
          clientId: client.id,
          fullAddress: "Knez Mihailova 10, Beograd",
        },
      }),
      service = await db.service.findUniqueOrThrow({
        where: { code: "regular" },
      });
    const createOrder = (time: string, extra: Record<string, unknown> = {}) =>
      db.order.create({
        data: {
          reference: "SCH-" + randomUUID().slice(0, 8),
          clientId: client.id,
          addressId: address.id,
          serviceId: service.id,
          area: 55,
          status: "SCHEDULED",
          scheduledStart: localInstant(time),
          manualDurationMinutes: 150,
          travelBufferMinutes: 30,
          basePrice: 4000,
          finalPrice: 4000,
          ...extra,
        },
      });
    const profile = {
      name: "Анна · проверка",
      phone: "0641234567",
      additionalContact: null,
      homeAddress: "Dorćol",
      languages: ["Русский", "Сербский"],
      skills: ["Поддерживающая"],
      internalRating: 4.5,
      payoutPercent: null,
      notes: "Private cleaner notes",
      defaultTravelMode: "PUBLIC_TRANSIT",
    };
    const week = Array.from({ length: 7 }, (_, i) => ({
      weekday: i + 1,
      working: true,
      startMinute: 0,
      endMinute: 1440,
    }));
    let anna = "",
      boris = "",
      cookie = "",
      primary = "",
      flex = "",
      adjacent = "";
    async function plan(id: string, changes: Record<string, unknown> = {}) {
      const o = await db.order.findUniqueOrThrow({ where: { id } }),
        crew = await db.orderCleaner.findMany({
          where: { orderId: id, removedAt: null },
        });
      const payload = {
        id,
        expectedUpdatedAt: o.updatedAt.toISOString(),
        scheduledStart: localInput(o.scheduledStart) || null,
        manualDurationMinutes: o.manualDurationMinutes,
        cleanerIds: crew.map((a) => a.cleanerId),
        ...changes,
      };
      try {return await execute("order-plan",payload);} catch(error) {
        // Old scheduling scenarios explicitly acknowledge the newly introduced missing-route warning.
        if(error instanceof SchedulingError&&error.issues.every(i=>i.code==="ROUTE_UNVERIFIED")&&!changes.acknowledged) return execute("order-plan",{...payload,acknowledged:error.issues.map(i=>i.key),overrideReason:"Local fixture has no Google coordinates"});
        throw error;
      }
    }
    const isConflict = (error: unknown, code: string) =>
      error instanceof SchedulingError &&
      error.issues.some((i) => i.code === code);
    async function warning(
      id: string,
      changes: Record<string, unknown>,
      code: string,
    ) {
      try {
        await plan(id, changes);
        assert.fail("Expected warning");
      } catch (error) {
        assert(isConflict(error, code));
        assert(error instanceof SchedulingError);
        return error.issues;
      }
    }
    const post = (
      command: string,
      payload: unknown,
      headers: Record<string, string> = {},
    ) =>
      fetch(base + "/api/admin/scheduling/" + command, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: base!,
          Cookie: cookie,
          ...headers,
        },
        body: JSON.stringify(payload),
      });
    try {
      await t.test(
        "cleaner create/edit/weekly and date CRUD are audited without contact/notes in audit",
        async () => {
          anna = (await execute("cleaner-create", { cleaner: profile })).id;
          boris = (
            await execute("cleaner-create", {
              cleaner: {
                ...profile,
                name: "Борис · проверка",
                defaultTravelMode: "CAR",
              },
            })
          ).id;
          await execute("cleaner-update", {
            id: anna,
            cleaner: {
              ...profile,
              additionalContact: "Telegram",
              payoutPercent: 50,
            },
          });
          for (const id of [anna, boris])
            await execute("availability-week", { id, week });
          await execute("availability-date", {
            id: anna,
            date: "2026-10-09",
            kind: "AVAILABLE",
            startMinute: 600,
            endMinute: 1080,
            reason: "Custom day",
          });
          await execute("availability-remove", {
            id: anna,
            date: "2026-10-09",
          });
          assert.equal(
            await db.cleanerAvailability.count({ where: { cleanerId: anna } }),
            7,
          );
          const count = await db.auditLog.count({ where: { entityId: anna } });
          await execute("cleaner-update", {
            id: anna,
            cleaner: {
              ...profile,
              additionalContact: "Telegram",
              payoutPercent: 50,
            },
          });
          await execute("availability-week", { id: anna, week });
          assert.equal(
            await db.auditLog.count({ where: { entityId: anna } }),
            count,
          );
          const audit = JSON.stringify(
            await db.auditLog.findMany({ where: { entityId: anna } }),
          );
          assert(!audit.includes(profile.notes));
          assert(!audit.includes(profile.phone));
        },
      );
      await t.test(
        "multi-crew assignment and derived end preserve estimated duration fallback",
        async () => {
          primary = (
            await createOrder("2026-10-10T14:00", { requiredCleaners: 2 })
          ).id;
          await plan(primary, { cleanerIds: [anna, boris] });
          assert.equal(
            await db.orderCleaner.count({
              where: { orderId: primary, removedAt: null },
            }),
            2,
          );
          assert.equal(
            (
              await db.order.findUniqueOrThrow({ where: { id: primary } })
            ).scheduledEnd!.toISOString(),
            "2026-10-10T14:30:00.000Z",
          );
          await db.order.update({
            where: { id: primary },
            data: { estimatedDurationMinutes: 90 },
          });
          await plan(primary, { manualDurationMinutes: null });
          assert.equal(
            (
              await db.order.findUniqueOrThrow({ where: { id: primary } })
            ).scheduledEnd!.toISOString(),
            "2026-10-10T13:30:00.000Z",
          );
          await plan(primary, { manualDurationMinutes: 150 });
        },
      );
      await t.test(
        "overlap errors roll back mutations, assignments, overrides and audit",
        async () => {
          adjacent = (await createOrder("2026-10-10T17:00")).id;
          await plan(adjacent, { cleanerIds: [anna] });
          const before = await db.auditLog.count({
            where: { entityId: adjacent },
          });
          const beforeOverrides=await db.schedulingOverride.count({where:{orderId:adjacent}});
          await assert.rejects(
            () =>
              plan(adjacent, {
                scheduledStart: "2026-10-10T15:00",
                acknowledged: ["OVERLAP"],
                overrideReason: "Cannot override",
              }),
            (error) => isConflict(error, "OVERLAP"),
          );
          assert.equal(
            localInput(
              (await db.order.findUniqueOrThrow({ where: { id: adjacent } }))
                .scheduledStart,
            ),
            "2026-10-10T17:00",
          );
          assert.equal(
            await db.auditLog.count({ where: { entityId: adjacent } }),
            before,
          );
          assert.equal(
            await db.schedulingOverride.count({ where: { orderId: adjacent } }),
            beforeOverrides,
          );
        },
      );
      await t.test(
        "operational gap warning needs exact acknowledgements/reason and is recorded",
        async () => {
          const beforeOverrides=await db.schedulingOverride.count({where:{orderId:adjacent}});
          const changes = { scheduledStart: "2026-10-10T16:45" },
            issues = await warning(adjacent, changes, "OPERATING_GAP");
          await assert.rejects(() =>
            plan(adjacent, {
              ...changes,
              acknowledged: issues.map((i) => i.key),
              overrideReason: "x",
            }),
          );
          await plan(adjacent, {
            ...changes,
            acknowledged: issues.map((i) => i.key),
            overrideReason: "Owner confirms operational exception",
          });
          assert.equal(
            await db.schedulingOverride.count({ where: { orderId: adjacent } }),
            beforeOverrides+1,
          );
          await plan(adjacent, { scheduledStart: "2026-10-10T17:00" });
        },
      );
      await t.test(
        "date-off needs explicit override; partial outside-hours detected",
        async () => {
          await execute("availability-date", {
            id: anna,
            date: "2026-10-10",
            kind: "UNAVAILABLE",
            startMinute: null,
            endMinute: null,
            reason: "Day off",
          });
          const changes = { manualDurationMinutes: 151 },
            issues = await warning(primary, changes, "DATE_OFF");
          await plan(primary, {
            ...changes,
            acknowledged: issues.map((i) => i.key),
            overrideReason: "Confirmed with cleaner",
          });
          await execute("availability-date", {
            id: anna,
            date: "2026-10-10",
            kind: "AVAILABLE",
            startMinute: 540,
            endMinute: 960,
          });
          await warning(
            primary,
            { manualDurationMinutes: 152 },
            "OUTSIDE_HOURS",
          );
          await execute("availability-remove", {
            id: anna,
            date: "2026-10-10",
          });
          await plan(primary, { manualDurationMinutes: 150 });
        },
      );
      await t.test(
        "unassign retains historical row and reassignment reuses it; shortage can be acknowledged",
        async () => {
          const row = await db.orderCleaner.findUniqueOrThrow({
              where: {
                orderId_cleanerId: { orderId: primary, cleanerId: boris },
              },
            }),
            issues = await warning(
              primary,
              { cleanerIds: [anna] },
              "UNDERSTAFFED",
            );
          await plan(primary, {
            cleanerIds: [anna],
            acknowledged: issues.map((i) => i.key),
            overrideReason: "Owner checks reduced crew",
          });
          assert(
            (await db.orderCleaner.findUniqueOrThrow({ where: { id: row.id } }))
              .removedAt,
          );
          await plan(primary, { cleanerIds: [anna, boris] });
          assert.equal(
            (await db.orderCleaner.findUniqueOrThrow({ where: { id: row.id } }))
              .removedAt,
            null,
          );
        },
      );
      await t.test(
        "inactive cleaner remains historically assigned, cannot receive a new order",
        async () => {
          await execute("cleaner-active", { id: boris, active: false });
          assert.equal(
            await db.orderCleaner.count({
              where: { orderId: primary, cleanerId: boris, removedAt: null },
            }),
            1,
          );
          const fresh = await createOrder("2026-10-11T09:00");
          await assert.rejects(() => plan(fresh.id, { cleanerIds: [boris] }));
          await execute("cleaner-active", { id: boris, active: true });
        },
      );
      await t.test(
        "flexible placement retains promise, rejects outside-window and can be unplaced",
        async () => {
          flex = (
            await createOrder("2026-10-12T14:00", {
              scheduleMode: "FLEXIBLE",
              scheduledStart: null,
              windowFrom: localInstant("2026-10-12T13:00"),
              windowTo: localInstant("2026-10-12T17:00"),
            })
          ).id;
          await plan(flex, {
            scheduledStart: "2026-10-12T14:00",
            cleanerIds: [anna],
            source: "CALENDAR_DRAG",
          });
          assert.equal(
            (
              await db.order.findUniqueOrThrow({ where: { id: flex } })
            ).windowFrom!.getTime(),
            localInstant("2026-10-12T13:00").getTime(),
          );
          await assert.rejects(
            () => plan(flex, { scheduledStart: "2026-10-12T15:00" }),
            (e) => isConflict(e, "FLEX_WINDOW"),
          );
          await plan(flex, { scheduledStart: null, source: "UNPLACE" });
          assert.equal(
            (await db.order.findUniqueOrThrow({ where: { id: flex } }))
              .scheduledEnd,
            null,
          );
        },
      );
      await t.test(
        "cancelled/no-show no longer block their original cleaner",
        async () => {
          for (const [status, time] of [
            ["CANCELLED", "2026-10-13T09:00"],
            ["NO_SHOW", "2026-10-14T09:00"],
          ] as const) {
            const closed = await createOrder(time);
            await plan(closed.id, { cleanerIds: [anna] });
            await runCrmCommand(db, uid, "order-status", {
              id: closed.id,
              status,
              reason: "Local cancellation check",
            });
            const next = await createOrder(time);
            await plan(next.id, { cleanerIds: [anna] });
          }
        },
      );
      await t.test(
        "same cleaner concurrent different-order reservations allow only one success",
        async () => {
          const a = await createOrder("2026-10-15T09:00"),
            b = await createOrder("2026-10-15T09:00");
          const results = await Promise.allSettled([
            plan(a.id, { cleanerIds: [anna] }),
            plan(b.id, { cleanerIds: [anna] }),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert(
            results.some(
              (r) => r.status === "rejected" && isConflict(r.reason, "OVERLAP"),
            ),
          );
        },
      );
      await t.test(
        "stale edits are rejected; unchanged save creates no audit/override",
        async () => {
          const o = await db.order.findUniqueOrThrow({
            where: { id: primary },
          });
          await plan(primary, { manualDurationMinutes: 149 });
          await assert.rejects(() =>
            execute("order-plan", {
              id: primary,
              expectedUpdatedAt: o.updatedAt.toISOString(),
              scheduledStart: "2026-10-10T14:00",
              manualDurationMinutes: 148,
              cleanerIds: [anna, boris],
            }),
          );
          await plan(primary, { manualDurationMinutes: 150 });
          const audit = await db.auditLog.count({
              where: { entityId: primary },
            }),
            overrides = await db.schedulingOverride.count({
              where: { orderId: primary },
            });
          await plan(primary);
          assert.equal(
            await db.auditLog.count({ where: { entityId: primary } }),
            audit,
          );
          assert.equal(
            await db.schedulingOverride.count({ where: { orderId: primary } }),
            overrides,
          );
        },
      );
      await t.test(
        "existing CRM edit cannot bypass scheduling conflict validation",
        async () => {
          await assert.rejects(
            () =>
              runCrmCommand(db, uid, "order-update", {
                id: adjacent,
                order: {
                  service: "regular",
                  area: 55,
                  soilLevel: "NORMAL",
                  extras: [],
                  urgent: false,
                  requiredCleaners: 1,
                  manualDurationMinutes: 150,
                  scheduleMode: "FIXED",
                  scheduledStart: "2026-10-10T15:00",
                  finalPrice: 4000,
                },
              }),
            (e) => isConflict(e, "OVERLAP"),
          );
        },
      );
      await t.test(
        "anonymous/current role denied, ADMIN allowed, exact origin and malformed input enforced",
        async () => {
          assert.equal(
            (await post("cleaner-active", { id: anna, active: false })).status,
            401,
          );
          assert.equal((await fetch(base + "/api/admin/calendar")).status, 401);
          const login = await fetch(base + "/api/auth/sign-in/email", {
            method: "POST",
            headers: { "Content-Type": "application/json", Origin: base! },
            body: JSON.stringify({ email, password }),
          });
          assert.equal(login.status, 200);
          cookie = login.headers
            .getSetCookie()
            .map((v) => v.split(";")[0])
            .join("; ");
          assert.equal(
            (await post("cleaner-active", { id: anna, active: true })).status,
            200,
          );
          assert.equal(
            (
              await post(
                "cleaner-active",
                { id: anna, active: false },
                { Origin: "https://evil.example" },
              )
            ).status,
            403,
          );
          assert.equal(
            (await post("cleaner-active", { id: "../wrong", active: true }))
              .status,
            400,
          );
          await db.user.update({
            where: { id: uid },
            data: { role: "CLEANER" },
          });
          assert.equal(
            (await post("cleaner-active", { id: anna, active: false })).status,
            403,
          );
          assert.equal(
            (
              await fetch(base + "/api/admin/calendar", {
                headers: { Cookie: cookie },
              })
            ).status,
            403,
          );
          await assert.rejects(() => plan(primary));
          await db.user.update({ where: { id: uid }, data: { role: "ADMIN" } });
        },
      );
      await t.test(
        "calendar is bounded, keeps crew filter, returns private DTO and no read audit",
        async () => {
          const headers = { Cookie: cookie },
            before = await db.auditLog.count({ where: { userId: uid } });
          for (const [mode, days] of [
            ["day", 1],
            ["week", 7],
            ["month", 42],
          ] as const) {
            const r = await fetch(
              `${base}/api/admin/calendar?mode=${mode}&date=2026-10-10&cleanerId=${anna}`,
              { headers },
            );
            assert.equal(r.status, 200);
            assert.match(r.headers.get("cache-control")!, /no-store/);
            const result = await r.json();
            assert.equal(result.data.days.length, days);
            assert(
              result.data.orders.some((o: { id: string }) => o.id === primary),
            );
            assert(!JSON.stringify(result).includes(profile.notes));
            assert(!JSON.stringify(result).includes("finalPrice"));
          }
          assert.equal(
            (
              await fetch(base + "/api/admin/calendar?date=2026-02-30", {
                headers,
              })
            ).status,
            400,
          );
          const far = await fetch(
            base + "/api/admin/calendar?mode=week&date=2030-01-01",
            { headers },
          );
          assert.equal((await far.json()).data.orders.length, 0);
          for (const path of [
            "/admin/calendar?date=2026-10-10",
            "/admin/cleaners",
            `/admin/cleaners/${anna}`,
            `/admin/orders/${primary}`,
            "/admin/orders/new?scheduledStart=2026-10-10T09%3A00",
            "/admin/leads",
            "/admin/clients",
          ]) {
            const r = await fetch(base + path, { headers });
            assert.equal(r.status, 200);
            const html = await r.text();
            assert(!html.includes("NEXT_HTTP_ERROR_FALLBACK;500"));
          }
          assert.equal(
            await db.auditLog.count({ where: { userId: uid } }),
            before,
          );
          writeFileSync(
            "artifacts/admin/scheduling-fixture.json",
            JSON.stringify({
              email,
              password,
              userId: uid,
              anna,
              boris,
              primary,
              adjacent,
              flex,
              clientId: client.id,
              addressId: address.id,
            }),
          );
        },
      );
    } finally {
      await db.$disconnect();
    }
  },
);
