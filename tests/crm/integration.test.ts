import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import test from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import {
  runCrmCommand,
  DuplicateClientError,
} from "../../src/lib/services/crm-commands";
import {
  saveWebsiteLead,
  notifyWebsiteLead,
} from "../../src/lib/services/website-leads";
import { websiteLeadSchema } from "../../src/lib/validation/crm";
import {
  leadWhere,
  clientWhere,
  orderWhere,
} from "../../src/lib/domain/crm-filters";
const dbUrl = process.env.ADMIN_TEST_DATABASE_URL,
  base = process.env.ADMIN_TEST_BASE_URL;
test(
  "CRM core: database transactions and authenticated HTTP flows",
  { skip: !dbUrl || !base },
  async (t) => {
    const url = new URL(dbUrl!),
      origin = new URL(base!);
    assert.equal(url.hostname, "127.0.0.1");
    assert.equal(url.pathname, "/lumaclean_admin_test");
    assert.equal(origin.hostname, "localhost");
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: dbUrl!, max: 3 }),
    });
    const uid = randomUUID(),
      password = randomUUID() + "Aa!7",
      email = `crm-${uid}@example.test`;
    const actor = await db.user.create({
      data: {
        id: uid,
        name: "CRM проверка",
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
      command: Parameters<typeof runCrmCommand>[2],
      payload: unknown,
    ) => runCrmCommand(db, actor.id, command, payload);
    const website = {
      submissionId: randomUUID(),
      name: "CRM Website",
      phone: "064 1234567",
      locale: "ru",
      service: "regular",
      area: 55,
      urgent: true,
      extras: [{ code: "standardWindow", quantity: 2 }],
      consent: true,
      comment: "Fixture comment",
      estimate: "Snapshot",
      attribution: { source: "direct_or_unknown", landing: "/ru" },
    };
    let leadId = "",
      clientId = "",
      addressId = "",
      orderId = "",
      cookie = "";
    const data = {
      service: "regular",
      area: 55,
      soilLevel: "HEAVY",
      extras: [
        { code: "standardWindow", quantity: 2 },
        { code: "oven", quantity: 1 },
      ],
      urgent: false,
      requiredCleaners: 2,
      manualDurationMinutes: 180,
      scheduleMode: "FIXED",
      scheduledStart: "2026-10-10T14:00",
      finalPrice: 12500,
      priceChangeReason: "Сильное загрязнение",
    };
    const call = async (
      command: string,
      payload: unknown,
      headers: Record<string, string> = {},
    ) =>
      fetch(`${base}/api/admin/crm/${command}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin.origin,
          Cookie: cookie,
          ...headers,
        },
        body: JSON.stringify(payload),
      });
    try {
      await t.test(
        "website intake and concurrent retry save exactly one linked lead and audit",
        async () => {
          const results = await Promise.all([
            saveWebsiteLead(db, website),
            saveWebsiteLead(db, website),
            saveWebsiteLead(db, website),
          ]);
          leadId = results[0].id;
          assert(
            results.every(
              (r) => r.id === leadId && r.reference === results[0].reference,
            ),
          );
          assert.equal(results.filter((r) => r.created).length, 1);
          const lead = await db.lead.findUniqueOrThrow({
            where: { id: leadId },
            include: { service: true, extras: true },
          });
          assert.equal(lead.service?.code, "regular");
          assert.equal(lead.normalizedPhone, "+381641234567");
          assert.equal(Number(lead.estimatedPrice), 7700);
          assert.equal(lead.extras.length, 1);
          assert.equal(
            await db.auditLog.count({
              where: { entityId: leadId, action: "LEAD_CREATED" },
            }),
            1,
          );
          await assert.rejects(
            saveWebsiteLead(db, { ...website, name: "Changed" }),
          );
          await assert.rejects(
            saveWebsiteLead(db, {
              ...website,
              submissionId: randomUUID(),
              service: "wrong",
            }),
          );
        },
      );
      await t.test(
        "Telegram failure leaves persisted lead intact and logs no contacts",
        async () => {
          const logs: string[] = [];
          const previous = console.error;
          const oldToken=process.env.TELEGRAM_BOT_TOKEN, oldChat=process.env.TELEGRAM_CHAT_ID;
          process.env.TELEGRAM_BOT_TOKEN="fixture-only";process.env.TELEGRAM_CHAT_ID="fixture-only";
          let sent=0;
          console.error = (v) => logs.push(String(v));
          try {
            await notifyWebsiteLead(
              db,
              { id: leadId, reference: "LC-TEST" },
              websiteLeadSchema.parse(website),
              async () => {
                sent++;
                throw Error("private upstream");
              },
            );
          } finally {
            console.error = previous;
            if(oldToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldToken;
            if(oldChat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=oldChat;
          }
          assert.equal(sent,1);
          assert.equal(
            (await db.lead.findUniqueOrThrow({ where: { id: leadId } }))
              .telegramStatus,
            "FAILED",
          );
          assert(!logs.join().includes(website.phone));
          assert(!logs.join().includes(website.name));
        },
      );
      await t.test("Telegram success sends the persisted reference and updates delivery status",async()=>{
        const oldToken=process.env.TELEGRAM_BOT_TOKEN,oldChat=process.env.TELEGRAM_CHAT_ID;
        process.env.TELEGRAM_BOT_TOKEN="fixture-only";process.env.TELEGRAM_CHAT_ID="fixture-only";
        try{await notifyWebsiteLead(db,{id:leadId,reference:"LC-TEST-SUCCESS"},websiteLeadSchema.parse(website),async(_url,options)=>{
          const message=JSON.parse(String(options?.body));assert(message.text.includes("LC-TEST-SUCCESS"));assert(message.text.includes("Поддерживающая уборка"));return Response.json({ok:true});
        });assert.equal((await db.lead.findUniqueOrThrow({where:{id:leadId}})).telegramStatus,"SENT");}
        finally{if(oldToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldToken;if(oldChat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=oldChat;}
      });
      await t.test(
        "public HTTP saves successfully even with delivery disabled and returns stable reference",
        async () => {
          const payload = {
            ...website,
            submissionId: randomUUID(),
            name: "CRM HTTP",
          };
          const post = () =>
            fetch(`${base}/api/lead`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
          const first = await post();
          assert.equal(first.status, 200);
          const body = await first.json();
          assert.equal(body.ok, true);
          const repeat = await post();
          assert.equal(repeat.status, 200);
          assert.equal((await repeat.json()).reference, body.reference);
          assert.equal(
            await db.lead.count({
              where: { submissionId: payload.submissionId },
            }),
            1,
          );
          const invalid = await fetch(`${base}/api/lead`, {
            method: "POST",
            body: JSON.stringify({ ...payload, area: -1 }),
          });
          assert.equal(invalid.status, 400);
          assert.equal((await fetch(`${base}/api/lead`)).status, 405);
        },
      );
      await t.test(
        "lead status and LOST reason enforce centralized transitions and server filters",
        async () => {
          await assert.rejects(
            execute("lead-status", { id: leadId, status: "LOST" }),
          );
          await execute("lead-status", { id: leadId, status: "IN_PROGRESS" });
          await execute("lead-note", {
            id: leadId,
            note: "Internal private note",
          });
          assert.equal(
            await db.lead.count({
              where: leadWhere({
                q: "CRM Website",
                status: "IN_PROGRESS",
                channel: "WEBSITE",
                service: "regular",
              }),
            }),
            1,
          );
          await execute("lead-status", {
            id: leadId,
            status: "LOST",
            reason: "Передумал",
          });
          await execute("lead-status", { id: leadId, status: "IN_PROGRESS" });
          assert(
            (await db.auditLog.count({
              where: { entityId: leadId, action: "LEAD_STATUS_CHANGED" },
            })) >= 3,
          );
        },
      );
      await t.test(
        "client create/edit, duplicate matching, contact search and multiple addresses",
        async () => {
          clientId = (
            await execute("client-create", {
              client: {
                name: "CRM Client",
                phone: "+381 64 1234567",
                telegram: "@crm_fixture",
                discountPercent: 10,
              },
            })
          ).id;
          await assert.rejects(
            execute("client-create", {
              client: { name: "CRM Duplicate", phone: "0641234567" },
              leadId,
            }),
            DuplicateClientError,
          );
          await execute("client-create", {
            client: { name: "CRM Shared Family Phone", phone: "0641234567" },
            allowDuplicate: true,
          });
          await execute("client-update", {
            id: clientId,
            client: {
              name: "CRM Client Edited",
              phone: "+381641234567",
              telegram: "@crm_fixture",
              discountPercent: 10,
              notes: "Private fixture note",
            },
          });
          assert.equal(
            await db.client.count({
              where: clientWhere({ q: "@crm_fixture" }),
            }),
            1,
          );
          addressId = (
            await execute("address-create", {
              clientId,
              address: {
                label: "Дом",
                fullAddress: "Fixture address 10",
                apartment: "7",
                floor: "2",
                intercom: "test",
              },
            })
          ).id;
          const second = (
            await execute("address-create", {
              clientId,
              address: { label: "Airbnb", fullAddress: "Fixture address 20" },
            })
          ).id;
          await execute("address-update", {
            clientId,
            id: second,
            address: { label: "Airbnb 2", fullAddress: "Fixture address 21" },
          });
          await execute("address-active", {
            clientId,
            id: second,
            active: false,
          });
          assert.equal(
            (
              await db.clientAddress.findUniqueOrThrow({
                where: { id: second },
              })
            ).active,
            false,
          );
          await execute("lead-link", { id: leadId, clientId });
        },
      );
      await t.test(
        "manual order validates price reason, fixed/flexible time and address ownership",
        async () => {
          await assert.rejects(
            execute("order-create", {
              requestId: randomUUID(),
              clientId,
              addressId,
              order: { ...data, priceChangeReason: null },
            }),
          );
          await assert.rejects(
            execute("order-create", {
              requestId: randomUUID(),
              clientId,
              addressId,
              order: { ...data, scheduledStart: null },
            }),
          );
          const other = (
            await execute("client-create", {
              client: { name: "CRM Other", phone: "+79123456789" },
            })
          ).id;
          await assert.rejects(
            execute("order-create", {
              requestId: randomUUID(),
              clientId: other,
              addressId,
              order: data,
            }),
          );
          const requestId = randomUUID();
          orderId = (
            await execute("order-create", {
              requestId,
              clientId,
              addressId,
              order: data,
            })
          ).id;
          assert.equal(
            (
              await execute("order-create", {
                requestId,
                clientId,
                addressId,
                order: data,
              })
            ).id,
            orderId,
          );
          const order = await db.order.findUniqueOrThrow({
            where: { id: orderId },
            include: { extras: true },
          });
          assert.equal(
            order.scheduledStart?.toISOString(),
            "2026-10-10T12:00:00.000Z",
          );
          assert.equal(Number(order.basePrice), 7500);
          assert.equal(Number(order.discountAmount), 750);
          assert.equal(Number(order.priceAdjustment), 5750);
          assert.equal(order.extras.length, 2);
          assert.equal(order.estimatedDurationMinutes, null);
          const wrongAddress = (
            await execute("address-create", {
              clientId: other,
              address: { fullAddress: "Other fixture address" },
            })
          ).id;
          await assert.rejects(
            execute("order-update", {
              id: orderId,
              addressId: wrongAddress,
              order: data,
            }),
          );
          await assert.rejects(
            execute("order-create", {
              requestId: randomUUID(),
              clientId,
              addressId,
              order: {
                ...data,
                scheduleMode: "FLEXIBLE",
                windowFrom: "2026-10-10T17:00",
                windowTo: "2026-10-10T13:00",
              },
            }),
          );
          const flexible = await execute("order-create", {
            requestId: randomUUID(),
            clientId,
            addressId,
            order: {
              ...data,
              scheduleMode: "FLEXIBLE",
              windowFrom: "2026-10-10T13:00",
              windowTo: "2026-10-10T17:00",
              scheduledStart: null,
              finalPrice: null,
              priceChangeReason: null,
            },
          });
          assert.equal(
            (
              await db.order.findUniqueOrThrow({ where: { id: flexible.id } })
            ).windowFrom?.toISOString(),
            "2026-10-10T11:00:00.000Z",
          );
          assert.equal(
            await db.order.count({
              where: orderWhere({
                clientId,
                from: "2026-10-10",
                to: "2026-10-10",
              }),
            }),
            2,
          );
          await assert.rejects(
            execute("order-status", { id: flexible.id, status: "CANCELLED" }),
          );
          await execute("order-status", {
            id: flexible.id,
            status: "CANCELLED",
            reason: "Fixture cancellation",
          });
        },
      );
      await t.test(
        "failed lead conversion rolls back new client/address/order/audit then atomic conversion succeeds",
        async () => {
          const counts = await Promise.all([
            db.client.count(),
            db.order.count(),
            db.clientAddress.count(),
            db.auditLog.count(),
          ]);
          await assert.rejects(
            execute("order-create", {
              requestId: randomUUID(),
              leadId,
              newClient: { name: "CRM Rollback", phone: "+447911123456" },
              newAddress: { fullAddress: "Rollback fixture" },
              order: { ...data, priceChangeReason: null },
            }),
          );
          assert.deepEqual(
            await Promise.all([
              db.client.count(),
              db.order.count(),
              db.clientAddress.count(),
              db.auditLog.count(),
            ]),
            counts,
          );
          assert.equal(
            (await db.lead.findUniqueOrThrow({ where: { id: leadId } })).status,
            "IN_PROGRESS",
          );
          const converted = await execute("order-create", {
            requestId: randomUUID(),
            leadId,
            clientId,
            addressId,
            order: { ...data, finalPrice: null, priceChangeReason: null },
          });
          const lead = await db.lead.findUniqueOrThrow({
            where: { id: leadId },
            include: { orders: true },
          });
          assert.equal(lead.status, "CONVERTED");
          assert.equal(lead.clientId, clientId);
          assert.equal(lead.orders[0].id, converted.id);
          await assert.rejects(
            execute("order-create", {
              requestId: randomUUID(),
              leadId,
              clientId,
              addressId,
              order: data,
            }),
          );
          await assert.rejects(
            execute("lead-status", { id: leadId, status: "NEW" }),
          );
        },
      );
      await t.test(
        "updates keep pricing snapshot, rescheduling audits and completion requires final price",
        async () => {
          const extra = await db.serviceExtra.findUniqueOrThrow({
            where: { code: "oven" },
          });
          await db.serviceExtra.update({
            where: { id: extra.id },
            data: { unitPrice: 9999 },
          });
          await execute("order-update", {
            id: orderId,
            order: {
              ...data,
              scheduledStart: "2026-10-11T14:00",
              internalComment: "Moved by owner",
            },
          });
          assert.equal(
            Number(
              (
                await db.orderExtra.findUniqueOrThrow({
                  where: { orderId_extraId: { orderId, extraId: extra.id } },
                })
              ).unitPrice,
            ),
            1100,
          );
          await db.serviceExtra.update({
            where: { id: extra.id },
            data: { unitPrice: extra.unitPrice },
          });
          await assert.rejects(
            execute("order-status", { id: orderId, status: "COMPLETED" }),
          );
          for (const status of [
            "CONFIRMED",
            "SCHEDULED",
            "EN_ROUTE",
            "IN_PROGRESS",
          ])
            await execute("order-status", { id: orderId, status });
          await db.order.update({
            where: { id: orderId },
            data: { finalPrice: null },
          });
          await assert.rejects(
            execute("order-status", { id: orderId, status: "COMPLETED" }),
          );
          await db.order.update({
            where: { id: orderId },
            data: { finalPrice: 12500 },
          });
          await execute("order-status", { id: orderId, status: "COMPLETED" });
          const complete = await db.order.findUniqueOrThrow({
            where: { id: orderId },
          });
          assert(complete.completedAt);
          assert.equal(complete.status, "COMPLETED");
          await assert.rejects(
            execute("order-update", { id: orderId, order: data }),
          );
          assert.equal(await db.cleanerPayout.count({ where: { orderId } }), 0);
          assert.equal(await db.expense.count({ where: { orderId } }), 0);
          assert.equal(
            await db.auditLog.count({
              where: { entityId: orderId, action: "ORDER_RESCHEDULED" },
            }),
            1,
          );
          await execute("address-active", {
            clientId,
            id: addressId,
            active: false,
          });
          assert.equal(
            (await db.order.findUniqueOrThrow({ where: { id: orderId } }))
              .addressId,
            addressId,
          );
          await assert.rejects(
            execute("order-create", {
              requestId: randomUUID(),
              clientId,
              addressId,
              order: data,
            }),
          );
          await execute("address-active", {
            clientId,
            id: addressId,
            active: true,
          });
          const audit = JSON.stringify(
            await db.auditLog.findMany({
              where: { entityId: { in: [leadId, clientId, orderId] } },
              select: { changes: true },
            }),
          );
          assert(!audit.includes("Private fixture"));
          assert(!audit.includes(website.phone));
        },
      );
      await t.test(
        "anonymous/CLEANER denied, ADMIN allowed, CSRF and invalid IDs blocked",
        async () => {
          assert.equal(
            (await call("lead-note", { id: leadId, note: "x" })).status,
            401,
          );
          const login = await fetch(`${base}/api/auth/sign-in/email`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Origin: origin.origin,
            },
            body: JSON.stringify({ email, password }),
          });
          assert.equal(login.status, 200);
          cookie = login.headers
            .getSetCookie()
            .map((c) => c.split(";")[0])
            .join("; ");
          assert.equal(
            (await call("lead-note", { id: leadId, note: "Admin approved" }))
              .status,
            200,
          );
          assert.equal(
            (
              await call(
                "lead-note",
                { id: leadId, note: "hostile" },
                { Origin: "https://evil.example" },
              )
            ).status,
            403,
          );
          await db.user.update({
            where: { id: uid },
            data: { role: "CLEANER" },
          });
          assert.equal(
            (await call("lead-note", { id: leadId, note: "unsafe" })).status,
            403,
          );
          await assert.rejects(
            execute("lead-note", { id: leadId, note: "unsafe" }),
          );
          await db.user.update({ where: { id: uid }, data: { role: "ADMIN" } });
          assert.equal(
            (await call("lead-note", { id: "missing", note: "x" })).status,
            404,
          );
          assert.equal(
            (await call("lead-note", { id: "../bad", note: "x" })).status,
            400,
          );
          for (const path of [
            `/admin/leads/${leadId}`,
            `/admin/clients/${clientId}`,
            `/admin/orders/${orderId}`,
            `/admin/orders/new?leadId=${leadId}`,
            `/admin/clients?q=crm_fixture`,
            `/admin/leads?status=CONVERTED&service=regular`,
          ])
            assert.equal(
              (await fetch(`${base}${path}`, { headers: { Cookie: cookie } }))
                .status,
              200,
            );
          writeFileSync(
            "artifacts/admin/crm-fixture.json",
            JSON.stringify({
              email,
              password,
              userId: uid,
              leadId,
              clientId,
              orderId,
              addressId,
            }),
          );
        },
      );
    } finally {
      await db.$disconnect();
    }
  },
);
