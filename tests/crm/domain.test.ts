import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizedPhone,
  localInstant,
  localInput,
  assertTransition,
} from "../../src/lib/domain/crm";
import { priceSnapshot } from "../../src/lib/domain/crm-pricing";
import {
  websiteLeadSchema,
  orderCreateSchema,
  orderSchema,
  clientSchema,
} from "../../src/lib/validation/crm";
import {
  calculatePrice,
  basePrice,
  serviceIds,
  extrasPrices,
} from "../../src/lib/pricing";
import { listOptions, orderWhere } from "../../src/lib/domain/crm-filters";
test("phone matching preserves national Serbia and explicit international numbers", () => {
  assert.equal(normalizedPhone("064 1234567"), "+381641234567");
  assert.equal(normalizedPhone("+381 64 1234567"), "+381641234567");
  assert.equal(normalizedPhone("+7 912 345 67 89"), "+79123456789");
  assert.equal(normalizedPhone("+44 7911 123456"), "+447911123456");
  for (const value of [
    "79123456789",
    "123456",
    "call me +381641234567",
    "+381123",
  ])
    assert.equal(normalizedPhone(value), null);
});
test("fixed and flexible wall times use Belgrade, reject ambiguous/missing DST", () => {
  assert.equal(
    localInstant("2026-10-10T14:00").toISOString(),
    "2026-10-10T12:00:00.000Z",
  );
  assert.equal(
    localInput(localInstant("2026-10-10T14:00")),
    "2026-10-10T14:00",
  );
  assert.throws(() => localInstant("2026-03-29T02:30"));
  assert.throws(() => localInstant("2026-10-25T02:30"));
  const where = orderWhere({ from: "2026-10-25", to: "2026-10-25" });
  const dates = where.AND as {
    OR: { scheduledStart: { gte?: Date; lt?: Date } }[];
  }[];
  assert.equal(
    dates[0].OR[0].scheduledStart.gte?.toISOString(),
    "2026-10-24T22:00:00.000Z",
  );
  assert.equal(
    dates[1].OR[0].scheduledStart.lt?.toISOString(),
    "2026-10-25T23:00:00.000Z",
  );
});
test("lead and order transitions cannot reopen converted or completed records", () => {
  assertTransition("Lead", "NEW", "IN_PROGRESS");
  assertTransition("Order", "IN_PROGRESS", "COMPLETED");
  assert.throws(() => assertTransition("Lead", "CONVERTED", "NEW"));
  assert.throws(() => assertTransition("Order", "DRAFT", "COMPLETED"));
  assert.throws(() => assertTransition("Order", "COMPLETED", "DRAFT"));
});
test("public price regression across 800 areas and every service with extras and urgent", () => {
  for (const service of serviceIds)
    for (let area = 1; area <= 800; area++) {
      const extras = [
        { code: "standardWindow" as const, quantity: 2 },
        { code: "oven" as const, quantity: 1 },
      ];
      const subtotal =
        basePrice(service, area) +
        2 * extrasPrices.standardWindow +
        extrasPrices.oven;
      assert.equal(
        calculatePrice(service, area, extras, true).total,
        subtotal + Math.round((subtotal * 0.2) / 100) * 100,
      );
    }
});
test("manual pricing reasons and typed validation reject unsafe inputs", () => {
  assert.throws(() => priceSnapshot(10700, 0, 12500, null));
  assert.equal(
    priceSnapshot(10700, 0, 12500, "Сильное загрязнение").priceAdjustment,
    1800,
  );
  assert.equal(priceSnapshot(10000, 10, null, null).finalPrice, 9000);
  assert.equal(websiteLeadSchema.safeParse({ consent: false }).success, false);
  assert.equal(
    clientSchema.safeParse({
      name: "Test",
      phone: "1234567",
      discountPercent: 101,
    }).success,
    false,
  );
  assert.equal(
    orderSchema.safeParse({
      service: "regular",
      area: 50,
      scheduleMode: "FIXED",
    }).success,
    false,
  );
  assert.equal(
    orderCreateSchema.safeParse({ requestId: "not-a-uuid" }).success,
    false,
  );
  assert.equal(listOptions({ page: "-1" }).page, 1);
});
