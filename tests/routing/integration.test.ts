import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { localInstant } from "../../src/lib/domain/crm";
import { runCrmCommand } from "../../src/lib/services/crm-commands";
import { runSchedulingCommand } from "../../src/lib/services/scheduling-commands";
import { SchedulingError } from "../../src/lib/domain/scheduling-types";
import { RoutingService } from "../../src/lib/services/route-cache";
import {
  routingSnapshot,
  proposeDay,
  applyProposal,
} from "../../src/lib/services/routing-planning";
import { preparationRequests } from "../../src/lib/domain/logistics";
import {
  routeSample,
  routeKey,
  type RoutingProvider,
  type RouteRequest,
  type RouteResult,
} from "../../src/lib/domain/routing";
import {
  signLocation,
  verifyLocation,
} from "../../src/lib/services/google-places";
const url = process.env.ADMIN_TEST_DATABASE_URL,
  base = process.env.ADMIN_TEST_BASE_URL;
test(
  "routing cache, proposal transactions and protected endpoints",
  { skip: !url || !base },
  async (t) => {
    assert.equal(new URL(url!).hostname, "127.0.0.1");
    assert.equal(new URL(url!).pathname, "/lumaclean_admin_test");
    assert.equal(new URL(base!).hostname, "localhost");
    const db = new PrismaClient({
        adapter: new PrismaPg({ connectionString: url!, max: 5 }),
      }),
      uid = randomUUID(),
      password = randomUUID() + "Aa!7",
      date = "2026-10-04";
    const owner = await db.user.create({
      data: {
        id: uid,
        name: "Логистика · local",
        email: "routing-" + uid + "@example.test",
        role: "ADMIN",
        emailVerified: true,
        accounts: {
          create: {
            providerId: "credential",
            accountId: uid,
            password: await hashPassword(password),
          },
        },
      },
    });
    process.env.BETTER_AUTH_SECRET ??=
      "local-routing-test-secret-with-at-least-32-characters";
    let calls = 0,
      elements = 0;
    const verified = (r: RouteRequest): RouteResult => ({
      status: "VERIFIED",
      durationSeconds: 20 * 60,
      distanceMeters: 3000,
      source: "Google",
      sampledAt: routeSample(r),
      calculatedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });
    const provider: RoutingProvider = {
      async getTravelTime(r) {
        calls++;
        return verified(r);
      },
      async getRouteMatrix(origins, destinations, mode, at, timing) {
        calls++;
        elements += origins.length * destinations.length;
        assert(origins.length * destinations.length <= 100);
        return origins.map((origin) =>
          destinations.map((destination) =>
            verified({ origin, destination, mode, at, timing }),
          ),
        );
      },
      async getRouteDetails(r) {
        calls++;
        return { result: verified(r), steps: [] };
      },
    };
    const service = new RoutingService(db, provider),
      client = await db.client.create({
        data: { name: "Routing local", phone: "0649990001" },
      }),
      address = await db.clientAddress.create({
        data: {
          clientId: client.id,
          fullAddress: "Terazije 10, Beograd",
          latitude: 44.81,
          longitude: 20.46,
          placeId: "fixture-place",
        },
      }),
      cleaner = await db.cleaner.create({
        data: {
          name: "Клинер логистики",
          phone: "0649990002",
          homeAddress: "Dorcol",
          homeLatitude: 44.82,
          homeLongitude: 20.45,
          availability: {
            create: Array.from({ length: 7 }, (_, i) => ({
              kind: "WEEKLY" as const,
              weekday: i + 1,
              startMinute: 0,
              endMinute: 1440,
            })),
          },
        },
      }),
      catalog = await db.service.findUniqueOrThrow({
        where: { code: "regular" },
      });
    const flex = await db.order.create({
      data: {
        clientId: client.id,
        addressId: address.id,
        serviceId: catalog.id,
        area: 55,
        status: "CONFIRMED",
        scheduleMode: "FLEXIBLE",
        windowFrom: localInstant(date + "T12:00"),
        windowTo: localInstant(date + "T17:00"),
        manualDurationMinutes: 150,
        travelBufferMinutes: 30,
        requiredCleaners: 1,
        reference: "ROUTE-" + uid.slice(0, 8),
      },
    });
    // Other stages leave active browser fixtures behind; mark only those local fixtures inactive.
    await db.cleaner.updateMany({
      where: { id: { not: cleaner.id } },
      data: { active: false },
    });
    let cookie = "";
    const call = (
      command: string,
      payload: unknown,
      headers: Record<string, string> = {},
    ) =>
      fetch(base + "/api/admin/routing/" + command, {
        method: "POST",
        headers: {
          Origin: base!,
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify(payload),
      });
    try {
      await t.test(
        "cache reuses fresh duration and separates departure buckets",
        async () => {
          const request: RouteRequest = {
            origin: { latitude: 44.82, longitude: 20.45 },
            destination: { latitude: 44.81, longitude: 20.46 },
            mode: "TRANSIT",
            at: localInstant(date + "T10:00").toISOString(),
          };
          const first = await service.getTravelTime(request),
            count = calls;
          assert.equal(first.durationSeconds, 1200);
          await service.getTravelTime(request);
          assert.equal(calls, count);
          await service.getTravelTime({
            ...request,
            at: localInstant(date + "T10:30").toISOString(),
          });
          assert.equal(calls, count + 1);
        },
      );
      await t.test("expired cache requests a fresh result", async () => {
        await db.routeCalculation.updateMany({
          data: { calculatedAt: new Date(0), expiresAt: new Date(1) },
        });
        const count = calls;
        const expiredRequest = {
          origin: { latitude: 44.82, longitude: 20.45 },
          destination: { latitude: 44.81, longitude: 20.46 },
          mode: "TRANSIT" as const,
          at: localInstant(date + "T10:00").toISOString(),
        };
        assert.equal(
          (await service.prepare([expiredRequest], true)).get(
            routeKey(expiredRequest),
          )?.status,
          "STALE",
        );
        await service.getTravelTime({
          origin: { latitude: 44.82, longitude: 20.45 },
          destination: { latitude: 44.81, longitude: 20.46 },
          mode: "TRANSIT",
          at: localInstant(date + "T10:00").toISOString(),
        });
        assert.equal(calls, count + 1);
      });
      await t.test(
        "batching is bounded and only computes requested destination pairs",
        async () => {
          const requests = Array.from({ length: 105 }, (_, i) => ({
              origin: { latitude: 44.82, longitude: 20.45 },
              destination: { latitude: 44.8 + i / 100000, longitude: 20.48 },
              mode: "TRANSIT" as const,
              at: localInstant(date + "T11:00").toISOString(),
            })),
            count = calls,
            oldElements = elements;
          await service.prepare(requests);
          assert.equal(calls - count, 2);
          assert.equal(elements - oldElements, 105);
        },
      );
      await t.test(
        "signed selected location cannot be forged or reused after edit",
        async () => {
          const proof = signLocation({
            address: "Terazije 10, Beograd",
            placeId: "fixture-place",
            latitude: 44.81,
            longitude: 20.46,
            expires: Date.now() + 600000,
          });
          assert.equal(verifyLocation(proof).latitude, 44.81);
          assert.throws(() => verifyLocation(proof.slice(0, -4) + "xxxx"));
          await assert.rejects(() =>
            runCrmCommand(db, uid, "address-update", {
              id: address.id,
              clientId: client.id,
              address: {
                fullAddress: "Different manual address",
                locationProof: proof,
              },
            }),
          );
        },
      );
      await t.test(
        "missing route warning requires explicit reason and current keys",
        async () => {
          const fixed = await db.order.create({
            data: {
              clientId: client.id,
              addressId: address.id,
              serviceId: catalog.id,
              area: 55,
              scheduledStart: localInstant("2026-10-06T09:00"),
              manualDurationMinutes: 60,
              travelBufferMinutes: 30,
            },
          });
          const plan = {
            id: fixed.id,
            expectedUpdatedAt: fixed.updatedAt.toISOString(),
            scheduledStart: "2026-10-06T09:00",
            manualDurationMinutes: 60,
            cleanerIds: [cleaner.id],
          };
          let issues: SchedulingError["issues"] = [];
          try {
            await runSchedulingCommand(db, uid, "order-plan", plan);
            assert.fail();
          } catch (e) {
            assert(e instanceof SchedulingError);
            issues = e.issues;
            assert(issues.some((i) => i.code === "ROUTE_UNVERIFIED"));
          }
          await runSchedulingCommand(db, uid, "order-plan", {
            ...plan,
            acknowledged: issues.map((i) => i.key),
            overrideReason: "Local test confirms unverified route",
          });
          assert.equal(
            await db.orderCleaner.count({
              where: { orderId: fixed.id, removedAt: null },
            }),
            1,
          );
        },
      );
      await t.test(
        "proposal changes nothing until applied and stale coordinates reject it",
        async () => {
          const snap = await routingSnapshot(db, date);
          await service.prepare(preparationRequests(snap, snap.orders));
          const result = await proposeDay(db, uid, date);
          assert(result.proposalId);
          assert.equal(
            (await db.order.findUniqueOrThrow({ where: { id: flex.id } }))
              .scheduledStart,
            null,
          );
          await db.clientAddress.update({
            where: { id: address.id },
            data: { latitude: 44.811 },
          });
          await assert.rejects(
            () => applyProposal(db, uid, result.proposalId!),
            /Расписание изменилось/,
          );
          assert.equal(
            await db.orderCleaner.count({ where: { orderId: flex.id } }),
            0,
          );
        },
      );
      await t.test(
        "proposal apply is atomic, audited and cannot be replayed",
        async () => {
          const snap = await routingSnapshot(db, date);
          await service.prepare(preparationRequests(snap, snap.orders));
          const result = await proposeDay(db, uid, date);
          assert(result.proposalId);
          const applied = await applyProposal(db, uid, result.proposalId!);
          assert.equal(applied.applied, 1);
          const actual = await db.order.findUniqueOrThrow({
            where: { id: flex.id },
          });
          assert(actual.scheduledStart! >= actual.windowFrom!);
          assert(actual.scheduledEnd! <= actual.windowTo!);
          assert.equal(
            await db.orderCleaner.count({
              where: { orderId: flex.id, removedAt: null },
            }),
            1,
          );
          assert.equal(
            await db.auditLog.count({
              where: { entityId: flex.id, action: "OPTIMIZATION_APPLIED" },
            }),
            1,
          );
          await assert.rejects(() =>
            applyProposal(db, uid, result.proposalId!),
          );
        },
      );
      await t.test(
        "creating a flexible order from a verified slot preserves its window and assigns the crew",
        async () => {
          const future = "2026-10-08",
            snap = await routingSnapshot(db, future);
          const candidate = {
            ...snap.orders[0],
            ...flex,
            id: "new-slot",
            updatedAt: flex.updatedAt.toISOString(),
            cleanerIds: [],
            label: address.fullAddress,
            reference: "new-slot",
            point: { latitude: 44.811, longitude: 20.46 },
            windowFrom: localInstant(future + "T12:00"),
            windowTo: localInstant(future + "T17:00"),
          };
          await service.prepare(preparationRequests(snap, [candidate]));
          const created = await runCrmCommand(db, uid, "order-create", {
            requestId: randomUUID(),
            clientId: client.id,
            addressId: address.id,
            suggestedCleanerIds: [cleaner.id],
            order: {
              service: "regular",
              area: 55,
              soilLevel: "NORMAL",
              urgent: false,
              extras: [],
              requiredCleaners: 1,
              manualDurationMinutes: 150,
              scheduleMode: "FLEXIBLE",
              windowFrom: future + "T12:00",
              windowTo: future + "T17:00",
              scheduledStart: future + "T12:00",
            },
          });
          const actual = await db.order.findUniqueOrThrow({
            where: { id: created.id },
          });
          assert.equal(actual.scheduleMode, "FLEXIBLE");
          assert.equal(
            actual.scheduledStart?.toISOString(),
            localInstant(future + "T12:00").toISOString(),
          );
          assert.equal(
            actual.windowTo?.toISOString(),
            localInstant(future + "T17:00").toISOString(),
          );
          assert.equal(
            await db.orderCleaner.count({
              where: { orderId: actual.id, removedAt: null },
            }),
            1,
          );
        },
      );
      await t.test(
        "address editing clears obsolete coordinates but unchanged address retains them",
        async () => {
          await runCrmCommand(db, uid, "address-update", {
            id: address.id,
            clientId: client.id,
            address: { fullAddress: address.fullAddress },
          });
          assert(
            (
              await db.clientAddress.findUniqueOrThrow({
                where: { id: address.id },
              })
            ).latitude,
          );
          await runCrmCommand(db, uid, "address-update", {
            id: address.id,
            clientId: client.id,
            address: { fullAddress: "Manual address, Beograd" },
          });
          const row = await db.clientAddress.findUniqueOrThrow({
            where: { id: address.id },
          });
          assert.equal(row.latitude, null);
          assert.equal(row.placeId, null);
        },
      );
      await t.test(
        "routing endpoints reject anonymous/CLEANER, malformed body, wrong origin and unsafe place input",
        async () => {
          assert.equal((await call("day", { date })).status, 401);
          const login = await fetch(base + "/api/auth/sign-in/email", {
            method: "POST",
            headers: { Origin: base!, "Content-Type": "application/json" },
            body: JSON.stringify({ email: owner.email, password }),
          });
          cookie = login.headers
            .getSetCookie()
            .map((v) => v.split(";")[0])
            .join("; ");
          assert(cookie);
          assert.equal(
            (
              await call(
                "day",
                { date },
                { Cookie: cookie, Origin: "https://evil.test" },
              )
            ).status,
            403,
          );
          assert.equal(
            (
              await call(
                "place",
                { placeId: "../../other", sessionToken: randomUUID() },
                { Cookie: cookie },
              )
            ).status,
            400,
          );
          await db.user.update({
            where: { id: uid },
            data: { role: "CLEANER" },
          });
          assert.equal(
            (await call("day", { date }, { Cookie: cookie })).status,
            403,
          );
          await db.user.update({ where: { id: uid }, data: { role: "ADMIN" } });
        },
      );
      await t.test(
        "Google disabled mode keeps day and Places readable without fabricated data",
        async () => {
          const day = await call("day", { date }, { Cookie: cookie });
          assert.equal(day.status, 200);
          const data = await day.json();
          assert.equal(data.data.available, false);
          assert(
            data.data.legs.every(
              (l: { route: RouteResult }) => l.route.durationSeconds === null,
            ),
          );
          const places = await call(
            "autocomplete",
            { query: "Belgrade", sessionToken: randomUUID() },
            { Cookie: cookie },
          );
          assert.equal(places.status, 200);
          assert.equal((await places.json()).data.available, false);
        },
      );
      await t.test(
        "owner-bound proposals do not accept another actor",
        async () => {
          const row = await db.schedulingProposal.findFirst({
            where: { userId: uid },
          });
          assert(row);
          await assert.rejects(() => applyProposal(db, randomUUID(), row.id));
        },
      );
      writeFileSync(
        "artifacts/admin/routing-fixture.json",
        JSON.stringify({
          email: owner.email,
          password,
          cleanerId: cleaner.id,
          orderId: flex.id,
          clientId: client.id,
          date,
        }),
      );
    } finally {
      await db.$disconnect();
    }
  },
);
