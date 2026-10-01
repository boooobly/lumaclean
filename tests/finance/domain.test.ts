import assert from "node:assert/strict";
import test from "node:test";
import { legacyFixture } from "./fixtures";
import {
  estimateDuration,
  actualDuration,
  durationAccuracy,
  type DurationConfig,
} from "../../src/lib/domain/duration";
import {
  payoutSnapshot,
  economics,
  financePeriod,
} from "../../src/lib/domain/finance";
import {
  excelDate,
  excelHours,
  legacyContact,
  parseLegacyWorkbook,
  validateXlsxZip,
} from "../../src/lib/domain/legacy-import";
import { overrideReason } from "../../src/lib/services/duration-engine";
export const rule: DurationConfig = {
  id: "rule-v1",
  serviceId: "regular",
  version: 1,
  active: true,
  minArea: 1,
  maxArea: 100,
  referenceArea: 100,
  baseMinutes: 150,
  minutesPerSquare: 0,
  cleanerCount: 2,
  soilMultipliers: { LIGHT: 0.8, NORMAL: 1, HEAVY: 1.5, EXTREME: 2 },
  extraMinutes: { fridge: 20 },
  reserveMinutes: 15,
};
const input = {
  serviceId: "regular",
  area: 100,
  soilLevel: "NORMAL",
  requiredCleaners: 2,
  extras: [],
};
test("duration is deterministic and bounded to a configured area/service/crew", () => {
  assert.deepEqual(
    estimateDuration(input, [rule]),
    estimateDuration(input, [rule]),
  );
  assert.equal(estimateDuration(input, [rule])?.estimatedDurationMinutes, 150);
  assert.equal(estimateDuration({ ...input, area: 101 }, [rule]), null);
  assert.equal(estimateDuration({ ...input, serviceId: "deep" }, [rule]), null);
  assert.equal(
    estimateDuration({ ...input, requiredCleaners: 1 }, [rule]),
    null,
  );
});
test("soil, excess area, extras, rounding and reserve are explicit factors", () => {
  const r = {
    ...rule,
    maxArea: 200,
    referenceArea: 100,
    minutesPerSquare: 1.1,
  };
  const result = estimateDuration(
    {
      ...input,
      area: 102,
      soilLevel: "HEAVY",
      extras: [{ code: "fridge", quantity: 2 }],
    },
    [r],
  )!;
  assert.equal(result.estimatedDurationMinutes, 270);
  assert.equal(result.cleaningReserveMinutes, 15);
  assert.equal(result.factors.extraMinutes, 40);
  assert.equal(
    estimateDuration({ ...input, extras: [{ code: "unknown", quantity: 1 }] }, [
      r,
    ]),
    null,
  );
});
test("overlapping rules and oversized estimates are rejected", () => {
  assert.throws(() =>
    estimateDuration(input, [rule, { ...rule, id: "other" }]),
  );
  assert.throws(() =>
    estimateDuration({ ...input, soilLevel: "EXTREME" }, [
      { ...rule, baseMinutes: 1000 },
    ]),
  );
});
test("manual override requires reason; unchanged legacy manual plan remains readable", () => {
  assert.throws(() => overrideReason(170, 150, null));
  assert.equal(
    overrideReason(170, 150, "Больше загрязнений"),
    "Больше загрязнений",
  );
  assert.equal(overrideReason(null, 150, null), null);
  assert.equal(
    overrideReason(170, 150, null, {
      manualDurationMinutes: 170,
      durationOverrideReason: null,
    }),
    null,
  );
});
test("actual duration spans full crew work, not sum of their hours", () => {
  const start = new Date("2026-09-25T09:00:00Z"),
    end = new Date("2026-09-25T11:00:00Z");
  assert.equal(
    actualDuration([
      { startedAt: start, finishedAt: end, removedAt: null },
      {
        startedAt: new Date("2026-09-25T09:30Z"),
        finishedAt: new Date("2026-09-25T11:30Z"),
        removedAt: null,
      },
    ]),
    150,
  );
  assert.equal(
    actualDuration([{ startedAt: start, finishedAt: null, removedAt: null }]),
    null,
  );
});
test("duration recommendations expose sample size and never update a rule", () => {
  assert.equal(
    durationAccuracy([
      { service: "regular", band: "60–100", planned: 150, actual: 174 },
    ])[0].recommendation,
    null,
  );
  const a = durationAccuracy(
    Array.from({ length: 8 }, () => ({
      service: "regular",
      band: "60–100",
      planned: 150,
      actual: 174,
    })),
  )[0];
  assert.equal(a.meanError, 24);
  assert.equal(a.n, 8);
  assert(a.recommendation?.includes("24"));
});
test("each cleaner receives their own percent, individual precedes default", () => {
  assert.deepEqual(payoutSnapshot(10000, 25, 30), {
    basisAmount: 10000,
    appliedPercent: 25,
    amount: 2500,
  });
  assert.equal(payoutSnapshot(10000, null, 25)?.amount, 2500);
  assert.equal(payoutSnapshot(10000, null, null), null);
  assert.equal(payoutSnapshot(10000, 0, 25)?.amount, 0);
  assert.equal(payoutSnapshot(1.01, 50, null)?.amount, 0.51);
});
test("payout-linked Expense never subtracts the same operation twice", () => {
  assert.deepEqual(
    economics(
      12000,
      [
        { amount: 600, payoutId: null },
        { amount: 6000, payoutId: "p1" },
      ],
      [
        { amount: 6000, status: "PAID" },
        { amount: 1000, status: "CANCELLED" },
      ],
    ),
    { revenue: 12000, businessExpenses: 600, accrued: 6000, profit: 5400 },
  );
});
test("month/previous/year/custom ranges use Belgrade inclusive dates, exclusive end", () => {
  const now = new Date("2026-10-01T10:00Z");
  assert.equal(
    financePeriod({}, now).from.toISOString(),
    "2026-09-30T22:00:00.000Z",
  );
  assert.equal(
    financePeriod({ period: "previous" }, now).fromLabel,
    "2026-09-01",
  );
  assert.equal(financePeriod({ period: "year" }, now).toLabel, "2026-12-31");
  assert.equal(
    financePeriod(
      { period: "custom", from: "2026-10-25", to: "2026-10-25" },
      now,
    ).to.getTime() -
      financePeriod(
        { period: "custom", from: "2026-10-25", to: "2026-10-25" },
        now,
      ).from.getTime(),
    25 * 3600000,
  );
  assert.throws(() =>
    financePeriod(
      { period: "custom", from: "2026-10-02", to: "2026-10-01" },
      now,
    ),
  );
});
test("Excel serials require date format, 1904 epoch and text dates are validated", () => {
  assert.equal(excelDate({ value: 46226, format: "dd.mm.yyyy" }), "2026-07-23");
  assert.equal(excelDate({ value: 46226, format: "0.0" }), null);
  assert.equal(excelDate({ value: "31.07.0206", format: "dd.mm.yyyy" }), null);
  assert.equal(excelDate({ value: "31.02.2026", format: "" }), null);
  assert.equal(
    excelDate({ value: 44764, format: "yyyy-mm-dd" }, true),
    "2026-07-23",
  );
});
test("duration/time cells are hours; date-formatted values are rejected", () => {
  assert.equal(
    excelHours({ value: { date: "1899-12-30T03:00:00Z" }, format: "[h]:mm" }),
    3,
  );
  assert.equal(excelHours({ value: 0.125, format: "[h]:mm" }), 3);
  assert.equal(excelHours({ value: 3, format: "0.0" }), 3);
  assert.equal(
    excelHours({ value: { date: "2026-07-01T00:00:00Z" }, format: "d.m" }),
    null,
  );
  assert.equal(excelHours({ value: 46204, format: "d.m" }), null);
  assert.equal(excelHours({ value: "2:30", format: "" }), 2.5);
});
test("client parser splits Telegram and Viber contacts without merging names", () => {
  assert.equal(legacyContact("Яна @yanatest007").name, "Яна");
  assert.equal(
    legacyContact("Дэни вайбер +381641234567").phone,
    "+381641234567",
  );
  assert.equal(legacyContact("Дэни вайбер +381641234567").name, "Дэни");
  assert.equal(legacyContact("Яна @yanatest007 @yanatest008").ambiguous, true);
});

test("only source sheets are parsed; repeat customers group by strong identity", () => {
  const p = parseLegacyWorkbook(legacyFixture());
  assert.equal(p.summary.orders, 2);
  assert.equal(p.summary.expenses, 1);
  assert.equal(p.summary.clients, 1);
  assert.equal(p.summary.merges[0].rows.length, 2);
  assert.equal(p.rows.length, 3);
  assert.equal(p.summary.blocked, 0);
});
test("ambiguous date, hours, category and contact stay visible in preview", () => {
  const b = legacyFixture();
  const s = b.getWorksheet("Заказы")!;
  s.getCell(6, 1).value = "31.07.0206";
  s.getCell(6, 3).value = "Яна @yanatest008";
  s.getCell(6, 12).value = new Date("2026-07-01");
  s.getCell(6, 12).numFmt = "d.m";
  b.getWorksheet("Расходы")!.getCell(5, 4).value = null;
  const p = parseLegacyWorkbook(b);
  assert.equal(p.summary.blocked, 2);
  assert(p.rows[1].warnings.some((w) => w.includes("Часы")));
  assert(p.rows[1].errors.some((w) => w.includes("Одинаковое имя")));
});
test("xlsx central directory bounds allow an ordinary workbook and reject invalid uploads", async () => {
  const b = legacyFixture(),
    bytes = Buffer.from(await b.xlsx.writeBuffer());
  assert.doesNotThrow(() => validateXlsxZip(bytes));
  assert.throws(() => validateXlsxZip(Buffer.alloc(10)));
  assert.throws(() => validateXlsxZip(Buffer.alloc(3 * 1024 * 1024)));
});

test("shared Telegram bridges phone-only rows, while conflicting phones block every row", () => {
  const b = legacyFixture(),
    sheet = b.getWorksheet("Заказы")!;
  sheet.getCell(5, 3).value = "Яна @yanatest007 +381641234567";
  sheet.getCell(6, 3).value = "Яна @yanatest007";
  let p = parseLegacyWorkbook(b);
  assert.equal(p.summary.clients, 1);
  assert.equal(p.rows[1].phone, "+381641234567");
  assert.equal(p.summary.blocked, 0);
  sheet.getCell(6, 3).value = "Яна @yanatest007 +381641234568";
  p = parseLegacyWorkbook(b);
  assert.equal(p.summary.blocked, 2);
  assert(
    p.rows
      .slice(0, 2)
      .every((r) =>
        r.errors.some((e) => e.startsWith("Повторный сильный контакт")),
      ),
  );
});
