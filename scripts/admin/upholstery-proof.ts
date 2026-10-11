import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { hashPassword } from "better-auth/crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../src/generated/prisma/client";
import { pgConnectionString } from "../../src/lib/database/connection";
import {
  runUpholsteryCommand,
  publicUpholsteryQuote,
  type upholsterySaveSchema,
} from "../../src/lib/services/upholstery-commands";
import { saveUpholsteryLead } from "../../src/lib/services/upholstery-leads";
import { upholsteryIssues } from "../../src/lib/services/upholstery-equipment";
import { runCrmCommand } from "../../src/lib/services/crm-commands";
import { runCalendarRepeat } from "../../src/lib/services/calendar-repeat";
import { executeAgentTool, type ToolContext } from "../../src/lib/agent/tools";
import { effectiveMode } from "../../src/lib/agent/readiness";
import { localInstant } from "../../src/lib/domain/crm";
import type { z } from "zod";
assert(
  new URL(process.env.DATABASE_URL!).hostname.startsWith(
    "ep-wispy-river-b8xwqy9q",
  ),
  "Isolated Preview only",
);
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: pgConnectionString(process.env.DATABASE_URL!),
    max: 6,
  }),
});
const manifestPath = "qa-output/upholstery-fixtures.json";
type Manifest = {
  prefix: string;
  userId: string;
  email: string;
  password: string;
  clientId: string;
  cleanerIds: string[];
  orderIds: string[];
  conversationIds: string[];
  leadIds: string[];
  checks: number;
  modes: unknown;
};
async function main() {
  if (process.argv[2] === "clean") {
    const m: Manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert(m.prefix.startsWith("upholstery-proof:"));
    assert(
      (
        await db.client.findUniqueOrThrow({ where: { id: m.clientId } })
      ).name.startsWith(m.prefix),
    );
    await db.$transaction(async (tx) => {
      const ids = (
        await tx.order.findMany({
          where: { clientId: m.clientId },
          select: { id: true },
        })
      ).map((o) => o.id);
      await tx.notification.deleteMany({ where: { orderId: { in: ids } } });
      await tx.orderUpholstery.deleteMany({ where: { orderId: { in: ids } } });
      await tx.orderExtra.deleteMany({ where: { orderId: { in: ids } } });
      await tx.orderCleaner.deleteMany({ where: { orderId: { in: ids } } });
      await tx.order.deleteMany({ where: { copiedFromId: { in: ids } } });
      await tx.orderRepeatSeries.deleteMany({
        where: { sourceOrderId: { in: ids } },
      });
      await tx.order.deleteMany({ where: { id: { in: ids } } });
      await tx.agentToolTrace.deleteMany({
        where: { conversationId: { in: m.conversationIds } },
      });
      await tx.agentJob.deleteMany({
        where: { conversationId: { in: m.conversationIds } },
      });
      await tx.message.deleteMany({
        where: { conversationId: { in: m.conversationIds } },
      });
      await tx.conversation.deleteMany({
        where: { id: { in: m.conversationIds } },
      });
      await tx.lead.deleteMany({ where: { id: { in: m.leadIds } } });
      await tx.clientAddress.deleteMany({ where: { clientId: m.clientId } });
      await tx.client.delete({ where: { id: m.clientId } });
      await tx.cleanerAvailability.deleteMany({
        where: { cleanerId: { in: m.cleanerIds } },
      });
      await tx.cleaner.deleteMany({ where: { id: { in: m.cleanerIds } } });
      await tx.session.deleteMany({ where: { userId: m.userId } });
      await tx.account.deleteMany({ where: { userId: m.userId } });
      await tx.user.update({
        where: { id: m.userId },
        data: { active: false },
      });
    });
    console.log({ cleaned: true, productionOrdersCreated: 0 });
    return;
  }
  const settings = await db.businessSettings.findUniqueOrThrow({
      where: { id: "default" },
    }),
    catalog = await db.upholsterySettings.findUniqueOrThrow({
      where: { id: "default" },
    }),
    prefix = "upholstery-proof:" + randomUUID(),
    userId = randomUUID(),
    password = randomUUID() + "Aa!7",
    email = `${userId}@example.test`;
  await db.user.create({
    data: {
      id: userId,
      name: "Upholstery Preview verifier",
      email,
      role: "ADMIN",
      emailVerified: true,
      accounts: {
        create: {
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  const client = await db.client.create({
      data: { name: prefix + " Екатерина" },
    }),
    address = await db.clientAddress.create({
      data: {
        clientId: client.id,
        fullAddress: "Upholstery Preview · Beograd",
        latitude: 44.817,
        longitude: 20.46,
        coordinatesConfirmed: true,
      },
    });
  const cleaners = await Promise.all(
    [1, 2].map((i) =>
      db.cleaner.create({
        data: {
          name: prefix + " crew " + i,
          phone: "0640000000",
          languages: ["ru"],
          skills: ["upholstery"],
          homeLatitude: 44.817,
          homeLongitude: 20.46,
          homeCoordinatesConfirmed: true,
          availability: {
            create: Array.from({ length: 7 }, (_, i) => ({
              kind: "WEEKLY",
              weekday: i + 1,
              startMinute: 0,
              endMinute: 1440,
            })),
          },
        },
      }),
    ),
  );
  const m: Manifest = {
    prefix,
    userId,
    email,
    password,
    clientId: client.id,
    cleanerIds: cleaners.map((c) => c.id),
    orderIds: [],
    conversationIds: [],
    leadIds: [],
    checks: 0,
    modes: { mode: settings.aiAgentMode, channels: settings.aiChannelModes },
  };
  mkdirSync("qa-output", { recursive: true });
  const save = () => writeFileSync(manifestPath, JSON.stringify(m, null, 2));
  save();
  const ok = (condition: unknown) => {
    assert(condition);
    m.checks++;
    save();
  };
  const item = {
    type: "SOFA3" as const,
    quantity: 1,
    soil: "NORMAL" as const,
    fabric: "WET_COMPATIBLE" as const,
    material: "Confirmed washable upholstery",
    size: "standard",
    notes: "",
  };
  const input: z.infer<typeof upholsterySaveSchema> = {
    requestId: randomUUID(),
    catalogVersion: catalog.version,
    clientId: client.id,
    addressId: address.id,
    request: { mode: "STANDALONE", items: [item], urgent: false },
    scheduledStart: "2026-10-13T14:30",
    cleanerIds: [cleaners[0].id],
    approve: true,
    reviewNote: "Владелец проверил ткань, фото и согласовал цену",
    photos: [],
    plannedMinutes: 40,
    preparationMinutes: 10,
    cleanupMinutes: 10,
    transferMinutes: 30,
    equipmentUnit: 1,
    equipmentCleanerId: cleaners[0].id,
    logisticsNote:
      "Ответственный забирает аппарат, перевозит и возвращает после очистки",
    patchTestConfirmed: false,
    finalPrice: null,
    priceReason: "",
    cleaningMinutes: null,
  };
  const preview = (await runUpholsteryCommand(
    db,
    userId,
    "preview",
    input,
  )) as { issues: unknown[] };
  ok(preview.issues.length === 0);
  ok((await db.order.count({ where: { clientId: client.id } })) === 0);
  const created = (await runUpholsteryCommand(db, userId, "save", input)) as {
    id: string;
  };
  m.orderIds.push(created.id);
  save();
  const o = await db.order.findUniqueOrThrow({
    where: { id: created.id },
    include: { upholstery: true },
  });
  ok(Number(o.finalPrice) === 3000 && o.status === "DRAFT");
  ok(o.upholstery?.reviewStatus === "APPROVED");
  ok(o.manualDurationMinutes === 60);
  ok(
    ((await runUpholsteryCommand(db, userId, "save", input)) as { id: string })
      .id === o.id,
  );
  ok((await db.order.count({ where: { clientId: client.id } })) === 1);
  const conflict = {
    ...input,
    requestId: randomUUID(),
    scheduledStart: "2026-10-13T14:45",
    cleanerIds: [cleaners[1].id],
    equipmentCleanerId: cleaners[1].id,
  };
  await assert.rejects(
    () => runUpholsteryCommand(db, userId, "save", conflict),
    (e) =>
      (e as { issues?: { code: string }[] }).issues?.some(
        (i) => i.code === "EXTRACTOR_CONFLICT",
      ) === true,
  );
  m.checks++;
  save();
  const plan = { ...o, cleanerIds: [cleaners[0].id] };
  const patchIssues = await db.$transaction((tx) =>
    upholsteryIssues(tx, { ...plan, status: "IN_PROGRESS" }),
  );
  ok(patchIssues.some((i) => i.code === "PATCH_TEST_REQUIRED"));
  const pendingInput = {
    ...input,
    requestId: randomUUID(),
    scheduledStart: "2026-10-16T14:30",
    approve: false,
    request: {
      ...input.request,
      items: [{ ...item, fabric: "UNKNOWN" as const }],
    },
    plannedMinutes: null,
    preparationMinutes: null,
    cleanupMinutes: null,
    transferMinutes: null,
    equipmentUnit: null,
    equipmentCleanerId: null,
  };
  const pending = (await runUpholsteryCommand(
    db,
    userId,
    "save",
    pendingInput,
  )) as { id: string };
  m.orderIds.push(pending.id);
  save();
  await assert.rejects(() =>
    runCrmCommand(db, userId, "order-status", {
      id: pending.id,
      status: "CONFIRMED",
      reason: "",
    }),
  );
  m.checks++;
  save();
  ok(
    (await db.order.findUniqueOrThrow({ where: { id: pending.id } })).status ===
      "DRAFT",
  );
  await assert.rejects(() =>
    runUpholsteryCommand(db, userId, "save", {
      ...input,
      requestId: randomUUID(),
      scheduledStart: "2026-10-20T14:30",
      request: { ...input.request, items: [{ ...item, fabric: "UNSAFE" }] },
    }),
  );
  m.checks++;
  save();
  const regular = await db.service.findUniqueOrThrow({
      where: { code: "regular" },
    }),
    base = await db.order.create({
      data: {
        clientId: client.id,
        addressId: address.id,
        serviceId: regular.id,
        area: 55,
        status: "DRAFT",
        scheduledStart: localInstant("2026-10-20T14:30"),
        manualDurationMinutes: 120,
        travelBufferMinutes: 30,
        basePrice: 4600,
        finalPrice: 4600,
      },
    });
  m.orderIds.push(base.id);
  save();
  const addon = {
    ...input,
    orderId: base.id,
    expectedUpdatedAt: base.updatedAt.toISOString(),
    requestId: randomUUID(),
    scheduledStart: "2026-10-20T14:30",
    request: {
      mode: "ADDON" as const,
      items: [{ ...item, type: "SPOT" as const }],
      urgent: false,
    },
  };
  await runUpholsteryCommand(db, userId, "save", addon);
  const added = await db.order.findUniqueOrThrow({
    where: { id: base.id },
    include: { upholstery: true },
  });
  ok(Number(added.finalPrice) === 6100);
  ok(added.manualDurationMinutes === 180);
  const shortenedIssues = await db.$transaction((tx) =>
    upholsteryIssues(tx, {
      ...added,
      manualDurationMinutes: 60,
      cleanerIds: [cleaners[0].id],
    }),
  );
  ok(shortenedIssues.some((i) => i.code === "EXTRACTOR_DURATION"));
  ok(
    (added.upholstery?.quote as { minimumAdjustment: number })
      .minimumAdjustment === 0,
  );
  const negotiated = await db.order.create({
    data: {
      clientId: client.id,
      addressId: address.id,
      serviceId: regular.id,
      area: 55,
      status: "DRAFT",
      scheduledStart: localInstant("2026-10-23T14:30"),
      manualDurationMinutes: 120,
      travelBufferMinutes: 30,
      basePrice: 14000,
      finalPrice: 12000,
      priceAdjustment: -2000,
      priceChangeReason: "Согласованный тариф",
    },
  });
  m.orderIds.push(negotiated.id);
  save();
  await runUpholsteryCommand(db, userId, "save", {
    ...addon,
    requestId: randomUUID(),
    orderId: negotiated.id,
    expectedUpdatedAt: negotiated.updatedAt.toISOString(),
    scheduledStart: "2026-10-23T14:30",
  });
  ok(
    Number(
      (await db.order.findUniqueOrThrow({ where: { id: negotiated.id } }))
        .finalPrice,
    ) === 13500,
  );
  const original = JSON.stringify(
    await db.order.findUnique({
      where: { id: o.id },
      include: { upholstery: true },
    }),
  );
  const copied = (await runCalendarRepeat(db, userId, "create", {
    requestId: randomUUID(),
    sourceId: o.id,
    expectedUpdatedAt: o.updatedAt.toISOString(),
    date: "2026-10-27",
    time: "14:30",
    cleanerIds: [cleaners[0].id],
    finalPrice: 3200,
    comment: "Новое согласование",
    weekly: false,
    weekdays: [],
    until: "2026-10-27",
    allowDuplicate: false,
  })) as { ids: string[] };
  m.orderIds.push(...copied.ids);
  save();
  const copy = await db.order.findUniqueOrThrow({
    where: { id: copied.ids[0] },
    include: { upholstery: true },
  });
  ok(
    copy.status === "DRAFT" &&
      copy.upholstery?.reviewStatus === "PENDING" &&
      copy.completedAt === null,
  );
  ok((copy.upholstery?.quote as { agreedTotal: number }).agreedTotal === 3200);
  ok(
    JSON.stringify(
      await db.order.findUnique({
        where: { id: o.id },
        include: { upholstery: true },
      }),
    ) === original,
  );
  ok(
    (await db.cleanerPayout.count({ where: { orderId: copy.id } })) === 0 &&
      (await db.expense.count({ where: { orderId: copy.id } })) === 0,
  );
  await assert.rejects(() =>
    runCrmCommand(db, userId, "order-status", {
      id: copy.id,
      status: "CONFIRMED",
      reason: "",
    }),
  );
  m.checks++;
  save();
  for (const text of [
    "Сколько стоит химчистка дивана?",
    "Koliko košta dubinsko pranje troseda?",
    "Can you clean a sofa stain?",
  ]) {
    process.env.AI_AGENT_ENABLED = "true";
    const conversation = await db.conversation.create({
      data: {
        channel: "WEBSITE",
        locale: text.startsWith("Koliko")
          ? "sr-Latn"
          : text.startsWith("Can")
            ? "en"
            : "ru",
        state: {},
        control: "AI_CONTROL",
      },
    });
    m.conversationIds.push(conversation.id);
    save();
    const message = await db.message.create({
        data: { conversationId: conversation.id, author: "CLIENT", text },
      }),
      leaseKey = randomUUID(),
      job = await db.agentJob.create({
        data: {
          conversationId: conversation.id,
          messageId: message.id,
          status: "RUNNING",
          leaseKey,
          leaseUntil: new Date(Date.now() + 180000),
        },
      });
    const ctx: ToolContext = {
      conversationId: conversation.id,
      jobId: job.id,
      leaseKey,
      revision: conversation.revision,
      mode: effectiveMode(settings, "WEBSITE"),
      state: {},
    };
    ok(
      !(
        await executeAgentTool(db, ctx, "markUpholsteryInquiry", {
          evidence: text,
        })
      ).error,
    );
    const q = await executeAgentTool(
      db,
      ctx,
      "calculateUpholstery",
      input.request,
    );
    ok(q.total === 3000 && q.autonomousBooking === false);
    ok(
      (
        await executeAgentTool(db, ctx, "findAvailableSlots", {
          date: "2026-10-13",
        })
      ).error !== undefined,
    );
    ok(
      (await executeAgentTool(db, ctx, "estimateDuration", {})).error ===
        "UPHOLSTERY_REVIEW_REQUIRED",
    );
    await db.agentJob.update({
      where: { id: job.id },
      data: { status: "DONE", leaseUntil: null, leaseKey: null },
    });
  }
  ok(
    (
      await publicUpholsteryQuote(db, {
        request: {
          mode: "STANDALONE",
          items: [{ ...item, soil: "LIGHT" }],
          urgent: false,
        },
      })
    ).total === 3000,
  );
  const leadRequest = {
    submissionId: randomUUID(),
    name: "Preview upholstery customer",
    phone: "+381640000000",
    locale: "ru",
    consent: true,
    request: {
      mode: "ADDON",
      items: [item],
      urgent: false,
      cleaning: { service: "regular", area: 55 },
    },
    comment: "Preview only",
    requestedDate: "2026-10-30",
  };
  const leadResult = await saveUpholsteryLead(db, leadRequest),
    lead = await db.lead.findUniqueOrThrow({
      where: { submissionId: leadRequest.submissionId },
    });
  m.leadIds.push(lead.id);
  save();
  ok(Number(lead.estimatedPrice) === 7600);
  ok(
    (lead.upholsteryQuote as { requestedDate: string }).requestedDate ===
      leadRequest.requestedDate &&
      lead.comment?.includes(leadRequest.requestedDate),
  );
  ok(
    (await saveUpholsteryLead(db, leadRequest)).reference ===
      leadResult.reference,
  );
  await db.lead.update({
    where: { id: lead.id },
    data: { clientId: client.id },
  });
  const combined = (await runUpholsteryCommand(db, userId, "save", {
    ...input,
    requestId: randomUUID(),
    leadId: lead.id,
    scheduledStart: "2026-10-30T14:30",
    request: leadRequest.request,
    cleaningMinutes: 120,
  })) as { id: string };
  m.orderIds.push(combined.id);
  save();
  const combinedOrder = await db.order.findUniqueOrThrow({
    where: { id: combined.id },
  });
  ok(
    Number(combinedOrder.finalPrice) === 7600 &&
      combinedOrder.leadId === lead.id,
  );
  ok(
    (await db.lead.findUniqueOrThrow({ where: { id: lead.id } })).status ===
      "CONVERTED",
  );
  await assert.rejects(() =>
    saveUpholsteryLead(db, {
      ...leadRequest,
      submissionId: randomUUID(),
      request: {
        ...leadRequest.request,
        items: [{ ...item, fabric: "UNSAFE" }],
      },
    }),
  );
  m.checks++;
  save();
  const extraLeadRequest = {
    ...leadRequest,
    submissionId: randomUUID(),
    request: {
      mode: "ADDON",
      items: [{ ...item, type: "SPOT" }],
      urgent: false,
    },
  };
  await saveUpholsteryLead(db, extraLeadRequest);
  const extraLead = await db.lead.findUniqueOrThrow({
    where: { submissionId: extraLeadRequest.submissionId },
  });
  m.leadIds.push(extraLead.id);
  save();
  await db.lead.update({
    where: { id: extraLead.id },
    data: { clientId: client.id },
  });
  const unknownBase = await db.order.create({
    data: {
      clientId: client.id,
      addressId: address.id,
      serviceId: regular.id,
      area: 55,
      status: "DRAFT",
      scheduledStart: localInstant("2026-11-03T14:30"),
      travelBufferMinutes: 30,
      basePrice: 4600,
      finalPrice: 4600,
    },
  });
  m.orderIds.push(unknownBase.id);
  save();
  const extraInput = {
    ...addon,
    orderId: unknownBase.id,
    leadId: extraLead.id,
    expectedUpdatedAt: unknownBase.updatedAt.toISOString(),
    requestId: randomUUID(),
    scheduledStart: "2026-11-03T14:30",
  };
  await assert.rejects(
    () => runUpholsteryCommand(db, userId, "save", extraInput),
    (e) => (e as Error).message.includes("длительность основной уборки"),
  );
  m.checks++;
  save();
  await runUpholsteryCommand(db, userId, "save", {
    ...extraInput,
    cleaningMinutes: 120,
  });
  const attachedOrder = await db.order.findUniqueOrThrow({
    where: { id: unknownBase.id },
  });
  ok(
    attachedOrder.leadId === null &&
      Number(attachedOrder.finalPrice) === 6100 &&
      attachedOrder.manualDurationMinutes === 180,
  );
  const convertedExtra = await db.lead.findUniqueOrThrow({
    where: { id: extraLead.id },
  });
  ok(
    convertedExtra.status === "CONVERTED" &&
      (convertedExtra.upholsteryQuote as { convertedOrderId: string })
        .convertedOrderId === unknownBase.id,
  );
  await assert.rejects(() =>
    runUpholsteryCommand(db, userId, "save", {
      ...extraInput,
      requestId: randomUUID(),
      expectedUpdatedAt: attachedOrder.updatedAt.toISOString(),
      cleaningMinutes: 120,
    }),
  );
  m.checks++;
  save();
  const after = await db.businessSettings.findUniqueOrThrow({
    where: { id: "default" },
  });
  ok(
    JSON.stringify(m.modes) ===
      JSON.stringify({
        mode: after.aiAgentMode,
        channels: after.aiChannelModes,
      }),
  );
  save();
  writeFileSync(
    "qa-output/upholstery-db-proof.json",
    JSON.stringify(
      {
        passed: true,
        checks: m.checks,
        productionOrdersCreated: 0,
        modesPreserved: true,
      },
      null,
      2,
    ),
  );
  console.log({
    passed: true,
    checks: m.checks,
    productionOrdersCreated: 0,
    modesPreserved: true,
  });
}
main()
  .finally(() => db.$disconnect())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  });
