import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { pgConnectionString } from "../../src/lib/database/connection";
import { runCalendarRepeat } from "../../src/lib/services/calendar-repeat";
import { runSchedulingCommand } from "../../src/lib/services/scheduling-commands";
import { localInput, localInstant } from "../../src/lib/domain/crm";
import { SchedulingError } from "../../src/lib/domain/scheduling-types";
import type { RepeatInput } from "../../src/lib/domain/calendar-repeat";
assert(
  new URL(process.env.DATABASE_URL!).hostname.startsWith(
    "ep-wispy-river-b8xwqy9q",
  ),
  "Isolated Preview only",
);
const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: pgConnectionString(process.env.DATABASE_URL!),
    max: 5,
  }),
});
const manifestPath = "qa-output/calendar-fixtures.json";
type Manifest = {
  prefix: string;
  userId: string;
  email: string;
  password: string;
  clientId: string;
  cleanerId: string;
  sourceId: string;
  seriesId?: string;
  copyId?: string;
  checks?: number;
  modes: unknown;
};
async function main() {
  if (process.argv[2] === "clean") {
    const m: Manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert(m.prefix.startsWith("calendar-proof:"));
    const source = await db.order.findUniqueOrThrow({
      where: { id: m.sourceId },
      include: { client: true },
    });
    assert(source.client.name.startsWith(m.prefix));
    const orders = await db.order.findMany({
        where: { OR: [{ id: m.sourceId }, { copiedFromId: m.sourceId }] },
        select: { id: true },
      }),
      ids = orders.map((o) => o.id);
    await db.$transaction(async (tx) => {
      await tx.orderExtra.deleteMany({ where: { orderId: { in: ids } } });
      await tx.orderCleaner.deleteMany({ where: { orderId: { in: ids } } });
      await tx.order.deleteMany({ where: { copiedFromId: m.sourceId } });
      await tx.orderRepeatSeries.deleteMany({
        where: { sourceOrderId: m.sourceId },
      });
      await tx.order.delete({ where: { id: m.sourceId } });
      await tx.clientAddress.deleteMany({ where: { clientId: m.clientId } });
      await tx.client.delete({ where: { id: m.clientId } });
      await tx.cleaner.delete({ where: { id: m.cleanerId } });
      // AuditLog is append-only; deleting its actor would mutate the audit FK.
      await tx.session.deleteMany({where:{userId:m.userId}});
      await tx.account.deleteMany({where:{userId:m.userId}});
      await tx.user.update({where:{id:m.userId},data:{active:false}});
    });
    console.log({
      cleaned: true,
      remainingOrders: await db.order.count({ where: { id: { in: ids } } }),
      auditPreserved: true,
    });
    return;
  }
  const settings = await db.businessSettings.findUniqueOrThrow({
      where: { id: "default" },
    }),
    prefix = "calendar-proof:" + randomUUID(),
    password = randomUUID() + "Aa7!",
    email = "calendar-" + randomUUID() + "@example.test";
  const userId = randomUUID();
  const user = await db.user.create({
    data: {
      id: userId,
      name: "Calendar Preview verifier",
      email,
      emailVerified: true,
      role: "ADMIN",
      accounts: {
        create: {
          providerId: "credential",
          accountId: userId,
          password: await hashPassword(password),
        },
      },
    },
  });
  const client = await db.client.create({
    data: { name: prefix + " Екатерина" },
  });
  const address = await db.clientAddress.create({
    data: {
      clientId: client.id,
      fullAddress: "Calendar Preview · Beograd",
      latitude: 44.817,
      longitude: 20.46,
      coordinatesConfirmed: true,
    },
  });
  const cleaner = await db.cleaner.create({
    data: {
      name: prefix + " Анна",
      phone: "0640000000",
      languages: ["ru"],
      skills: ["regular"],
      homeLatitude: 44.817,
      homeLongitude: 20.46,
      homeCoordinatesConfirmed: true,
      availability: {
        create: Array.from({ length: 7 }, (_, i) => ({
          kind: "WEEKLY" as const,
          weekday: i + 1,
          startMinute: 0,
          endMinute: 1440,
        })),
      },
    },
  });
  const service = await db.service.findUniqueOrThrow({
      where: { code: "regular" },
    }),
    extra = await db.serviceExtra.findFirstOrThrow({ where: { active: true } });
  const source = await db.order.create({
    data: {
      reference: "QA-CAL-" + randomUUID().slice(0, 8),
      clientId: client.id,
      addressId: address.id,
      serviceId: service.id,
      area: 55,
      status: "SCHEDULED",
      scheduledStart: localInstant("2026-10-13T14:30"),
      manualDurationMinutes: 120,
      durationOverrideReason: "Preview approved planning",
      cleaningReserveMinutes: 15,
      travelBufferMinutes: 30,
      basePrice: 14000,
      finalPrice: 12000,
      priceAdjustment: -2000,
      priceChangeReason: "Индивидуальные условия",
      internalComment: "Historical incident — must not copy",
      extras: { create: { extraId: extra.id, quantity: 1, unitPrice: 100 } },
      assignments: {
        create: { cleanerId: cleaner.id, acceptedAt: new Date() },
      },
    },
  });
  const m: Manifest = {
    prefix,
    userId: user.id,
    email,
    password,
    clientId: client.id,
    cleanerId: cleaner.id,
    sourceId: source.id,
    modes: { mode: settings.aiAgentMode, channels: settings.aiChannelModes },
  };
  mkdirSync("qa-output", { recursive: true });
  const save = () => writeFileSync(manifestPath, JSON.stringify(m, null, 2));
  save();
  let checks = 0;
  const ok = (value: unknown) => {
    assert(value);
    checks++;
  };
  const original = JSON.stringify(
    await db.order.findUnique({
      where: { id: source.id },
      include: { extras: true, assignments: true },
    }),
  );
  const input: RepeatInput = {
    sourceId: source.id,
    expectedUpdatedAt: source.updatedAt.toISOString(),
    date: "2026-10-20",
    time: "14:30",
    weekly: false,
    weekdays: [],
    until: "2026-10-20",
    cleanerIds: [cleaner.id],
    finalPrice: null,
    comment: "Новая уборка",
    allowDuplicate: false,
    requestId: randomUUID(),
  };
  const preview = await runCalendarRepeat(db, user.id, "preview", input);
  assert("rows" in preview && preview.rows);
  ok(preview.rows.length === 1 && preview.rows[0].issues.length === 0);
  const result = await runCalendarRepeat(db, user.id, "create", input);
  assert("ids" in result);
  m.copyId = result.ids[0];
  save();
  const copy = await db.order.findUniqueOrThrow({
    where: { id: m.copyId },
    include: { extras: true, assignments: true },
  });
  ok(localInput(copy.scheduledStart) === "2026-10-20T14:30");
  ok(copy.status === "DRAFT");
  ok(Number(copy.finalPrice) === 12000);
  ok(copy.priceChangeReason === "Индивидуальные условия");
  ok(copy.completedAt === null && copy.actualDurationMinutes === null);
  ok(copy.assignments[0].acceptedAt === null);
  ok(copy.internalComment === "Новая уборка");
  ok(Number(copy.extras[0].unitPrice) === 100);
  ok((await db.expense.count({ where: { orderId: copy.id } })) === 0);
  ok((await db.cleanerPayout.count({ where: { orderId: copy.id } })) === 0);
  ok((await db.notification.count({ where: { orderId: copy.id } })) === 0);
  const retries = await Promise.all([
    runCalendarRepeat(db, user.id, "create", input),
    runCalendarRepeat(db, user.id, "create", input),
  ]);
  ok(retries.every((r) => "ids" in r && r.ids[0] === copy.id));
  await assert.rejects(
    () =>
      runCalendarRepeat(db, user.id, "create", {
        ...input,
        requestId: randomUUID(),
        allowDuplicate: true,
      }),
    SchedulingError,
  );
  checks++;
  const duplicate = await runCalendarRepeat(db, user.id, "preview", {
    ...input,
    requestId: randomUUID(),
  });
  assert("rows" in duplicate && duplicate.rows);
  ok(
    "duplicate" in duplicate.rows[0] &&
      duplicate.rows[0].duplicate &&
      duplicate.rows[0].issues.some((i) => i.code === "OVERLAP"),
  );
  const weekly = {
    ...input,
    requestId: randomUUID(),
    weekly: true,
    date: "2026-10-13",
    until: "2026-11-06",
    weekdays: [2, 5],
  };
  // The explicit copied 20 Oct is already booked: preview must block that series.
  const conflict = await runCalendarRepeat(db, user.id, "preview", weekly);
  assert("rows" in conflict && conflict.rows);
  ok(
    conflict.rows.some(
      (r) => r.start === "2026-10-20T14:30" && r.issues.length,
    ),
  );
  await db.order.update({
    where: { id: copy.id },
    data: { status: "CANCELLED", cancellationReason: "Preview fixture only" },
  });
  const recurring = await runCalendarRepeat(db, user.id, "create", weekly);
  assert("seriesId" in recurring);
  m.seriesId = recurring.seriesId;
  save();
  const members = await db.order.findMany({
    where: { repeatSeriesId: m.seriesId },
    orderBy: { scheduledStart: "asc" },
  });
  ok(members.length === 7);
  ok(members.every((o) => localInput(o.scheduledStart).endsWith("14:30")));
  const member = members[0];
  await runSchedulingCommand(db, user.id, "order-plan", {
    id: member.id,
    expectedUpdatedAt: member.updatedAt.toISOString(),
    scheduledStart: localInput(member.scheduledStart).slice(0, 10) + "T16:00",
    manualDurationMinutes: 120,
    cleanerIds: [cleaner.id],
    source: "EDITOR",
  });
  ok(
    (await db.order.count({
      where: {
        repeatSeriesId: m.seriesId,
        scheduledStart: { in: members.slice(1).map((o) => o.scheduledStart!) },
      },
    })) === 6,
  );
  const info = await runCalendarRepeat(db, user.id, "series-info", {
    seriesId: m.seriesId,
  });
  assert("scopeVersion" in info);
  const changes = await runCalendarRepeat(db, user.id, "series-preview", {
    seriesId: m.seriesId,
    expectedUpdatedAt: info.updatedAt,
    time: "15:00",
    price: 12500,
  });
  assert("scopeVersion" in changes);
  await runCalendarRepeat(db, user.id, "series-update", {
    seriesId: m.seriesId,
    expectedUpdatedAt: changes.updatedAt,
    scopeVersion: changes.scopeVersion,
    confirmCount: changes.count,
    time: "15:00",
    price: 12500,
  });
  ok(
    (await db.order.findMany({ where: { repeatSeriesId: m.seriesId } })).every(
      (o) =>
        localInput(o.scheduledStart).endsWith("15:00") &&
        Number(o.finalPrice) === 12500,
    ),
  );
  const stop = await runCalendarRepeat(db, user.id, "series-info", {
    seriesId: m.seriesId,
  });
  assert("scopeVersion" in stop);
  await db.order.update({
    where: { id: members[1].id },
    data: { internalComment: "Changed after preview" },
  });
  await assert.rejects(() =>
    runCalendarRepeat(db, user.id, "series-stop", {
      seriesId: m.seriesId,
      expectedUpdatedAt: stop.updatedAt,
      scopeVersion: stop.scopeVersion,
      confirmCount: stop.count,
    }),
  );
  checks++;
  const fresh = await runCalendarRepeat(db, user.id, "series-info", {
    seriesId: m.seriesId,
  });
  assert("scopeVersion" in fresh);
  await runCalendarRepeat(db, user.id, "series-stop", {
    seriesId: m.seriesId,
    expectedUpdatedAt: fresh.updatedAt,
    scopeVersion: fresh.scopeVersion,
    confirmCount: fresh.count,
  });
  ok(
    (await db.order.count({
      where: { repeatSeriesId: m.seriesId, status: "CANCELLED" },
    })) === 7,
  );
  ok(
    JSON.stringify(
      await db.order.findUnique({
        where: { id: source.id },
        include: { extras: true, assignments: true },
      }),
    ) === original,
  );
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
  m.checks = checks;
  save();
  console.log({
    checks,
    passed: true,
    sourceId: source.id,
    copyId: copy.id,
    seriesId: m.seriesId,
    productionOrdersCreated: 0,
    modesPreserved: true,
  });
}
main()
  .finally(() => db.$disconnect())
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
