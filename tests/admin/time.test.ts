import assert from "node:assert/strict";
import test from "node:test";
import { businessPeriods } from "../../src/lib/domain/time";
import { businessSettingsSchema } from "../../src/lib/validation/admin";

test("Belgrade spring DST day is 23 hours and autumn day is 25 hours", () => {
  const spring = businessPeriods(
    new Date("2026-03-29T12:00:00Z"),
    "Europe/Belgrade",
  );
  const autumn = businessPeriods(
    new Date("2026-10-25T12:00:00Z"),
    "Europe/Belgrade",
  );
  assert.equal(
    (spring.dayTo.getTime() - spring.dayFrom.getTime()) / 3_600_000,
    23,
  );
  assert.equal(
    (autumn.dayTo.getTime() - autumn.dayFrom.getTime()) / 3_600_000,
    25,
  );
  assert.equal(spring.dayFrom.toISOString(), "2026-03-28T23:00:00.000Z");
  assert.equal(autumn.dayTo.toISOString(), "2026-10-25T23:00:00.000Z");
});
test("month boundaries follow business timezone across UTC midnight and DST", () => {
  const period = businessPeriods(
    new Date("2026-09-30T22:30:00Z"),
    "Europe/Belgrade",
  );
  assert.equal(period.monthFrom.toISOString(), "2026-09-30T22:00:00.000Z");
  assert.equal(period.monthTo.toISOString(), "2026-10-31T23:00:00.000Z");
});
test("business settings reject invalid timezones and payout percentages", () => {
  const base = {
    timezone: "Europe/Belgrade",
    defaultTravelBufferMinutes: 30,
    defaultCleanerPayoutPercent: null,
  };
  assert.equal(businessSettingsSchema.safeParse(base).success, true);
  assert.equal(
    businessSettingsSchema.safeParse({ ...base, timezone: "Belgrade" }).success,
    false,
  );
  assert.equal(
    businessSettingsSchema.safeParse({
      ...base,
      defaultCleanerPayoutPercent: 101,
    }).success,
    false,
  );
});
