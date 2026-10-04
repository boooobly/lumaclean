import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";

const base = process.env.ADMIN_TEST_BASE_URL;
const dbUrl = process.env.ADMIN_TEST_DATABASE_URL;

test(
  "admin authorization, real aggregates, auth policies and DB invariants",
  { skip: !base || !dbUrl },
  async () => {
    const origin = new URL(base!);
    const url = new URL(dbUrl!);
    assert.equal(origin.hostname, "localhost");
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/lumaclean_admin_test");
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: dbUrl!, max: 1 }),
    });
    const fixturePassword = randomUUID() + "aA!7";
    const userId = randomUUID();
    const email = `admin-${userId}@example.test`;
    const call = (path: string, options: RequestInit = {}) =>
      fetch(new URL(path, origin), { redirect: "manual", ...options });
    let cookie = "";
    try {
      await db.user.create({
        data: {
          id: userId,
          name: "Проверка интерфейса",
          email,
          emailVerified: true,
          role: "ADMIN",
          accounts: {
            create: {
              providerId: "credential",
              accountId: userId,
              password: await hashPassword(fixturePassword),
            },
          },
        },
      });
      for (const path of [
        "/admin",
        "/admin/calendar",
        "/admin/leads",
        "/admin/clients",
        "/admin/orders",
        "/admin/cleaners",
        "/admin/messages",
        "/admin/finances",
        "/admin/analytics",
        "/admin/settings",
      ]) {
        const response = await call(path);
        assert.equal(response.status, 307, path);
        assert.equal(response.headers.get("location"), "/admin/login", path);
      }
      const forged = await call("/admin", {
        headers: { Cookie: "better-auth.session_token=forged" },
      });
      assert.equal(forged.status, 307);
      assert.equal(
        (
          await call("/api/auth/sign-up/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email,
              password: fixturePassword,
              name: "Unsafe",
              role: "ADMIN",
            }),
          })
        ).status,
        404,
      );
      assert.equal(
        (await call("/api/auth/update-user", { method: "POST" })).status,
        404,
      );
      const hostile = await call("/api/auth/sign-in/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://other.example",
        },
        body: JSON.stringify({ email, password: fixturePassword }),
      });
      assert.equal(hostile.status, 403);
      const signin = await call("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin.origin },
        body: JSON.stringify({
          email,
          password: fixturePassword,
          rememberMe: false,
        }),
      });
      assert.equal(signin.status, 200);
      cookie = signin.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      assert.ok(cookie.includes("session_token="));
      const authHeaders = { Cookie: cookie };
      const dashboard = await call("/admin", { headers: authHeaders });
      assert.equal(dashboard.status, 200);
      const html = await dashboard.text();
      assert.ok(html.includes("Всё на своих местах."));
      assert.ok(html.includes("На сегодня уборок нет"));
      assert.match(dashboard.headers.get("x-robots-tag") || "", /noindex/);
      const settings = await call("/admin/settings", { headers: authHeaders });
      assert.ok((await settings.text()).includes("Europe/Belgrade"));
      for (const path of [
        "calendar",
        "leads",
        "clients",
        "orders",
        "cleaners",
        "messages",
        "finances",
        "analytics",
      ]) {
        assert.equal(
          (await call(`/admin/${path}`, { headers: authHeaders })).status,
          200,
          path,
        );
      }
      assert.equal(
        (await call("/admin/unknown", { headers: authHeaders })).status,
        404,
      );
      await db.user.update({
        where: { id: userId },
        data: { role: "CLEANER" },
      });
      assert.equal(
        (await call("/admin", { headers: authHeaders })).status,
        307,
      );
      await db.user.update({
        where: { id: userId },
        data: { role: "ADMIN", active: false },
      });
      assert.equal(
        (await call("/admin/settings", { headers: authHeaders })).status,
        307,
      );
      await db.user.update({ where: { id: userId }, data: { active: true } });
      await db.session.deleteMany({ where: { userId } });
      assert.equal(
        (await call("/admin", { headers: authHeaders })).status,
        307,
      );
      const repeatSignin = await call("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin.origin },
        body: JSON.stringify({ email, password: fixturePassword }),
      });
      assert.equal(repeatSignin.status, 200);
      cookie = repeatSignin.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      const signedOut = await call("/api/auth/sign-out", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin.origin,
          Cookie: cookie,
        },
        body: "{}",
      });
      assert.equal(signedOut.status, 200);
      assert.equal(await db.session.count({ where: { userId } }), 0);
      // Keep a fresh local session for aggregate checks.
      await db.rateLimit.deleteMany();
      const aggregateSignin = await call("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: origin.origin },
        body: JSON.stringify({ email, password: fixturePassword }),
      });
      assert.equal(aggregateSignin.status, 200);
      cookie = aggregateSignin.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ");
      // Persist only temporary local browser fixture; never operational records.
      mkdirSync("artifacts/admin", { recursive: true });
      writeFileSync(
        "artifacts/admin/browser-fixture.json",
        JSON.stringify({ email, password: fixturePassword, userId }),
      );
      const client = await db.client.create({
        data: { name: "Test", phone: "local-test" },
      });
      const other = await db.client.create({
        data: { name: "Other", phone: "local-test" },
      });
      const address = await db.clientAddress.create({
        data: { clientId: other.id, fullAddress: "Local test" },
      });
      const service = await db.service.findUniqueOrThrow({
        where: { code: "regular" },
      });
      await assert.rejects(
        db.order.create({
          data: {
            clientId: client.id,
            addressId: address.id,
            serviceId: service.id,
            area: 50,
            travelBufferMinutes: 30,
          },
        }),
      );
      const ownAddress = await db.clientAddress.create({
        data: { clientId: client.id, fullAddress: "Local test" },
      });
      const cleaner = await db.cleaner.create({
        data: { name: "Test", phone: "local-test", languages: [], skills: [] },
      });
      const lead = await db.lead.create({
        data: { name: "Test", phone: "local-test" },
      });
      const now = new Date();
      const order = await db.order.create({
        data: {
          clientId: client.id,
          addressId: ownAddress.id,
          serviceId: service.id,
          area: 50,
          travelBufferMinutes: 30,
          status: "COMPLETED",
          scheduledStart: now,
          completedAt: now,
          finalPrice: 10300,
        },
      });
      const expense = await db.expense.create({
        data: {
          category: "TRANSPORT",
          amount: 700,
          occurredAt: now,
          description: "Local test",
        },
      });
      const populated = await (
        await call("/admin", { headers: { Cookie: cookie } })
      ).text();
      const metricValues = [
        ...populated.matchAll(
          /class="admin-metric"[^>]*>[\s\S]*?<strong>(.*?)<\/strong>/g,
        ),
      ].map((match) => match[1]);
      assert.deepEqual(metricValues, ["1", "1", "2", "1"]);
      assert.match(populated, /<dd>10(?:\s|&nbsp;)300/);
      assert.match(populated, /<dd>700/);
      await assert.rejects(
        db.cleaner.create({
          data: {
            name: "Test",
            phone: "local-test",
            languages: [],
            skills: [],
            payoutPercent: 101,
          },
        }),
      );
      await assert.rejects(
        db.businessSettings.update({
          where: { id: "default" },
          data: { defaultTravelBufferMinutes: -1 },
        }),
      );
      await db.expense.delete({ where: { id: expense.id } });
      await db.order.delete({ where: { id: order.id } });
      await db.lead.delete({ where: { id: lead.id } });
      await db.cleaner.delete({ where: { id: cleaner.id } });
      await db.clientAddress.delete({ where: { id: ownAddress.id } });
      await db.clientAddress.delete({ where: { id: address.id } });
      await db.client.deleteMany({
        where: { id: { in: [client.id, other.id] } },
      });
      // Only invalid public input: no Telegram request or customer notification.
      assert.equal(
        (
          await call("/api/lead", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ consent: false }),
          })
        ).status,
        400,
      );
      await db.rateLimit.deleteMany();
      let limitedStatus = 0;
      for (let attempt = 0; attempt < 6; attempt++) {
        limitedStatus = (
          await call("/api/auth/sign-in/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: origin.origin,
            },
            body: JSON.stringify({ email, password: "invalid-password-123" }),
          })
        ).status;
      }
      assert.equal(limitedStatus, 429);
      await db.rateLimit.deleteMany();
      console.log(
        "Protected routes, forged/revoked sessions, live roles, inactive accounts, CSRF, closed registration and DB constraints verified.",
      );
    } finally {
      await db.$disconnect();
    }
  },
);
