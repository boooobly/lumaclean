import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { Prisma, PrismaClient } from "../../src/generated/prisma/client";
import { saveUpholsteryLead } from "../../src/lib/services/upholstery-leads";
import { upholsteryDefaults, type UpholsteryRequest } from "../../src/lib/upholstery";

// No connection, queue publication or delivery. Only the existing service is run.
function mockDatabase() {
  type Saved = Prisma.LeadCreateInput & { id: string };
  const leads = new Map<string, Saved>();
  const notifications: Prisma.NotificationCreateInput[] = [];
  const audits: Prisma.AuditLogCreateInput[] = [];
  const tx = {
    $queryRaw: async () => [],
    lead: {
      findUnique: async ({ where }: { where: { submissionId: string } }) => leads.get(where.submissionId) ?? null,
      create: async ({ data }: { data: Prisma.LeadCreateInput }) => {
        const saved = { ...data, id: randomUUID() };
        leads.set(data.submissionId!, saved);
        return saved;
      },
    },
    service: { findUniqueOrThrow: async () => ({ id: "upholstery-service", active: true }) },
    user: { findFirst: async () => ({ id: "mock-admin" }) },
    notification: { upsert: async ({ create }: { create: Prisma.NotificationCreateInput }) => { notifications.push(create); return create; } },
    auditLog: { create: async ({ data }: { data: Prisma.AuditLogCreateInput }) => { audits.push(data); return data; } },
  };
  const db = {
    upholsterySettings: { findUniqueOrThrow: async () => ({ catalog: upholsteryDefaults, version: 7 }) },
    businessSettings: { findUniqueOrThrow: async () => ({}) },
    $transaction: async (fn: (value: typeof tx) => unknown) => fn(tx),
  } as unknown as PrismaClient;
  return { db, leads, notifications, audits };
}

const request = (): UpholsteryRequest => ({ mode: "STANDALONE", urgent: false, items: [{ type: "SOFA3", quantity: 1, soil: "NORMAL", fabric: "UNKNOWN", size: "standard", material: "", notes: "" }] });
const payload = () => ({ submissionId: randomUUID(), name: "Synthetic test", phone: "+381601234567", locale: "ru", consent: true, request: request() });

test("upholstery form intake saves a review lead and durable Telegram event, without creating an order (mocked)", async () => {
  const { db, leads, notifications, audits } = mockDatabase();
  const result = await saveUpholsteryLead(db, payload());
  const lead = [...leads.values()][0];
  assert.match(result.reference!, /^UP-LEAD-/);
  assert.equal(lead.requestKind, "UPHOLSTERY");
  assert.equal(lead.humanReviewRequired, true);
  assert.equal(lead.telegramStatus, "PENDING");
  assert.ok(lead.consentAt);
  assert.equal(lead.estimatedPrice, 4600);
  assert.equal((lead.upholsteryQuote as { quote: { autonomousBooking: boolean; version: number } }).quote.autonomousBooking, false);
  assert.equal((lead.upholsteryQuote as { quote: { version: number } }).quote.version, 7);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].channel, "TELEGRAM");
  assert.equal(notifications[0].deliveryState, "PENDING");
  assert.match(notifications[0].text!, /Химчистка: требуется уточнение/);
  assert.equal(audits[0].action, "UPHOLSTERY_LEAD_CREATED");
});

test("identical retry returns the same lead and outbox event; changed payload with the same key is rejected (mocked)", async () => {
  const { db, leads, notifications } = mockDatabase(), input = payload();
  const first = await saveUpholsteryLead(db, input);
  assert.deepEqual(await saveUpholsteryLead(db, input), first);
  assert.equal(leads.size, 1);
  assert.equal(notifications.length, 1);
  await assert.rejects(saveUpholsteryLead(db, { ...input, name: "Different name" }), /другими условиями/);
});

test("combined request keeps manual review and separates home cleaning from upholstery in the notification (mocked)", async () => {
  const { db, leads, notifications } = mockDatabase(), input = payload();
  input.request = { ...request(), mode: "ADDON", cleaning: { service: "regular", area: 55 } };
  await saveUpholsteryLead(db, input);
  const lead = [...leads.values()][0];
  assert.equal(lead.requestKind, "CLEANING_UPHOLSTERY");
  assert.equal(lead.estimatedPrice, 10600);
  assert.equal(lead.humanReviewRequired, true);
  assert.match(notifications[0].text!, /6000 RSD \(без химчистки\)/);
});

test("unsafe fabric or missing consent never reaches lead/outbox creation (mocked)", async () => {
  const { db, leads, notifications } = mockDatabase(), input = payload();
  input.request.items[0].fabric = "UNSAFE";
  await assert.rejects(saveUpholsteryLead(db, input), /не допускает/);
  await assert.rejects(saveUpholsteryLead(db, { ...payload(), consent: false }));
  assert.equal(leads.size, 0);
  assert.equal(notifications.length, 0);
});

test('upholstery attribution reaches CRM and the durable notification, with stable retry identity (mocked)', async () => {
  const {db, leads, notifications} = mockDatabase();
  const input = {...payload(), attribution: {landing: '/sr/dubinsko-pranje-namestaja', source: 'google_business_profile'}};
  const first = await saveUpholsteryLead(db, input);
  assert.deepEqual(await saveUpholsteryLead(db, input), first);
  const lead = [...leads.values()][0];
  assert.equal(lead.entrySource, 'google_business_profile');
  assert.equal(lead.landingPage, '/sr/dubinsko-pranje-namestaja');
  assert.match(notifications[0].text!, /google_business_profile/);
  assert.match(notifications[0].text!, /\/sr\/dubinsko-pranje-namestaja/);
  assert.equal(leads.size, 1);
  assert.equal(notifications.length, 1);
});

test('attribution rejects arbitrary URLs, query strings and personal data before persistence (mocked)', async () => {
  for (const landing of ['https://example.com/private', '/ru?phone=PRIVATE', '/admin/leads/private']) {
    const {db, leads, notifications} = mockDatabase();
    await assert.rejects(saveUpholsteryLead(db, {...payload(), attribution: {landing, source: 'google'}}));
    assert.equal(leads.size, 0);
    assert.equal(notifications.length, 0);
  }
});
