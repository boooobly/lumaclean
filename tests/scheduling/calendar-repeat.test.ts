import assert from "node:assert/strict";
import test from "node:test";
import {
  repeatDates,
  repeatInput,
  calendarShortcutAllowed,
} from "../../src/lib/domain/calendar-repeat";
import { copyTemplate } from "../../src/lib/services/calendar-repeat";
import { localInstant, localInput } from "../../src/lib/domain/crm";
test("13 October 14:30 copied to 20 October retains Belgrade wall time", () => {
  const result = repeatDates({
    date: "2026-10-20",
    until: "2026-10-20",
    time: "14:30",
    weekly: false,
    weekdays: [],
  });
  assert.deepEqual(result, ["2026-10-20T14:30"]);
  assert.equal(localInput(localInstant(result[0])), "2026-10-20T14:30");
});
test("weekly Tue/Fri 14:30 is bounded and survives autumn/spring DST", () => {
  const values = repeatDates({
    date: "2026-10-13",
    until: "2026-12-07",
    time: "14:30",
    weekly: true,
    weekdays: [2, 5],
  });
  assert.equal(values.length, 16);
  assert.deepEqual(values.slice(0, 4), [
    "2026-10-13T14:30",
    "2026-10-16T14:30",
    "2026-10-20T14:30",
    "2026-10-23T14:30",
  ]);
  for (const v of values) assert.equal(localInput(localInstant(v)), v);
  assert.equal(
    localInstant("2026-10-23T14:30").toISOString(),
    "2026-10-23T12:30:00.000Z",
  );
  assert.equal(
    localInstant("2026-10-27T14:30").toISOString(),
    "2026-10-27T13:30:00.000Z",
  );
  for (const v of repeatDates({
    date: "2027-03-23",
    until: "2027-04-03",
    time: "14:30",
    weekly: true,
    weekdays: [2, 5],
  }))
    assert.equal(localInput(localInstant(v)), v);
  assert.throws(() =>
    repeatDates({
      date: "2026-10-13",
      until: "2027-10-13",
      time: "14:30",
      weekly: true,
      weekdays: [2],
    }),
  );
  assert.throws(() =>
    repeatDates({
      date: "2026-10-13",
      until: "2027-03-13",
      time: "14:30",
      weekly: true,
      weekdays: [1, 2, 3, 4, 5, 6, 7],
    }),
  );
  assert.throws(() => localInstant("2027-03-28T02:30"));
});
test("copy template preserves negotiated economics and excludes lifecycle/history", () => {
  const source = {
    clientId: "client",
    addressId: "address",
    serviceId: "regular",
    area: 55,
    soilLevel: "NORMAL",
    urgent: false,
    requiredCleaners: 2,
    manualDurationMinutes: 150,
    estimatedDurationMinutes: 120,
    durationOverrideReason: "Согласовано",
    durationSnapshot: { version: 1 },
    durationRuleVersion: 1,
    durationRuleId: "rule",
    cleaningReserveMinutes: 15,
    travelBufferMinutes: 30,
    basePrice: 14000,
    discountPercent: 0,
    discountAmount: 0,
    finalPrice: 12000,
    priceAdjustment: -2000,
    priceChangeReason: "Индивидуальный тариф",
    currency: "RSD",
    status: "COMPLETED",
    completedAt: new Date(),
    actualDurationMinutes: 200,
    expenses: [{}],
    payouts: [{}],
    notifications: [{}],
    clientComment: "incident",
    internalComment: "incident",
    assignments: [{ acceptedAt: new Date() }],
  };
  const template = copyTemplate(
    source as unknown as Parameters<typeof copyTemplate>[0],
  );
  assert.equal(template.finalPrice, 12000);
  assert.equal(template.priceChangeReason, "Индивидуальный тариф");
  assert.equal(template.manualDurationMinutes, 150);
  for (const key of [
    "id",
    "status",
    "completedAt",
    "actualDurationMinutes",
    "expenses",
    "payouts",
    "notifications",
    "clientComment",
    "internalComment",
    "assignments",
    "routeSnapshot",
    "aiConfirmation",
  ])
    assert.equal(key in template, false, key);
  assert.equal(source.status, "COMPLETED");
  assert.equal(source.finalPrice, 12000);
});
test("keyboard copy is calendar-scoped, excludes editors, selected text and mobile", () => {
  const element = (editor: boolean) =>
    ({ closest: () => (editor ? {} : null) }) as unknown as Element;
  assert.equal(calendarShortcutAllowed(element(false), "", false), true);
  assert.equal(calendarShortcutAllowed(element(true), "", false), false);
  assert.equal(
    calendarShortcutAllowed(element(false), "selected text", false),
    false,
  );
  assert.equal(calendarShortcutAllowed(element(false), "", true), false);
});
test("repeat request rejects unexpected financial fields and duplicate crew ids", () => {
  const input = {
    sourceId: "source",
    expectedUpdatedAt: new Date().toISOString(),
    date: "2026-10-20",
    time: "14:30",
    weekly: false,
    weekdays: [],
    until: "2026-10-20",
    cleanerIds: [],
    finalPrice: null,
    comment: "",
    requestId: crypto.randomUUID(),
  };
  assert.equal(repeatInput.safeParse(input).success, true);
  assert.equal(
    repeatInput.safeParse({ ...input, status: "COMPLETED" }).success,
    false,
  );
  assert.equal(
    repeatInput.safeParse({ ...input, cleanerIds: ["a", "a"] }).success,
    false,
  );
});
