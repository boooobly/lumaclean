import assert from "node:assert/strict";
import test from "node:test";
import {
  SchedulingConflictService as Service,
  calendarRange,
  localDayStart,
  plannedEnd,
  type PlanningOrder,
  type PlanningCleaner,
} from "../../src/lib/domain/scheduling-conflicts";
import { localInstant } from "../../src/lib/domain/crm";
import { schedulingSchemas } from "../../src/lib/validation/scheduling";
const order = (changes: Partial<PlanningOrder> = {}): PlanningOrder => ({
  id: "one",
  status: "SCHEDULED",
  scheduleMode: "FIXED",
  scheduledStart: localInstant("2026-10-10T14:00"),
  windowFrom: null,
  windowTo: null,
  manualDurationMinutes: 150,
  estimatedDurationMinutes: null,
  requiredCleaners: 1,
  travelBufferMinutes: 30,
  cleaningReserveMinutes: 0,
  cleanerIds: ["cleaner"],
  ...changes,
});
const cleaner: PlanningCleaner = {
  id: "cleaner",
  active: true,
  availability: Array.from({ length: 7 }, (_, i) => ({
    kind: "WEEKLY",
    weekday: i + 1,
    date: null,
    startMinute: 540,
    endMinute: 1200,
  })),
};
const codes = (o = order(), c = [cleaner], others: PlanningOrder[] = []) =>
  Service.check(o, c, others).map((i) => i.code);
test("fixed duration is elapsed time; manual wins over existing estimate", () => {
  const o = order({ estimatedDurationMinutes: 300 });
  assert.equal(plannedEnd(o)!.toISOString(), "2026-10-10T14:30:00.000Z");
  assert.equal(
    plannedEnd(
      order({ manualDurationMinutes: null, estimatedDurationMinutes: 60 }),
    )!.getTime() - o.scheduledStart!.getTime(),
    3600000,
  );
  assert.equal(plannedEnd(order({ manualDurationMinutes: null })), null);
});
test("overlap is non-overridable ERROR and exact boundary needs operational buffer", () => {
  const other = order({
    id: "two",
    scheduledStart: localInstant("2026-10-10T16:00"),
  });
  assert(
    Service.check(order(), [cleaner], [other]).some(
      (i) => i.code === "OVERLAP" && i.severity === "ERROR",
    ),
  );
  assert(
    codes(
      order(),
      [cleaner],
      [{ ...other, scheduledStart: localInstant("2026-10-10T16:30") }],
    ).includes("OPERATING_GAP"),
  );
  assert.deepEqual(
    codes(
      order(),
      [cleaner],
      [{ ...other, scheduledStart: localInstant("2026-10-10T17:00") }],
    ),
    [],
  );
});
test("cancelled/no-show release their slots while completed work still occupies its historic interval", () => {
  for (const status of ["CANCELLED", "NO_SHOW"])
    assert.deepEqual(
      codes(order(), [cleaner], [order({ id: "two", status })]),
      [],
    );
  assert(
    codes(
      order(),
      [cleaner],
      [order({ id: "two", status: "COMPLETED" })],
    ).includes("OVERLAP"),
  );
});
test("multi-cleaner conflicts are evaluated separately and shortage warned", () => {
  assert.deepEqual(codes(order({ requiredCleaners: 2 })), ["UNDERSTAFFED"]);
  const issues = Service.check(
    order({ cleanerIds: ["cleaner", "second"] }),
    [cleaner, { ...cleaner, id: "second" }],
    [order({ id: "two", cleanerIds: ["second"] })],
  );
  assert.equal(issues.find((i) => i.code === "OVERLAP")!.cleanerId, "second");
});
test("unknown duration stays unknown and cannot place a flexible order", () => {
  assert(
    codes(order({ manualDurationMinutes: null })).includes("DURATION_UNKNOWN"),
  );
  assert(
    codes(
      order({ manualDurationMinutes: null, scheduleMode: "FLEXIBLE" }),
    ).includes("FLEX_DURATION"),
  );
});
test("flexible entire job must fit promised window, pending flex doesn't invent start", () => {
  const o = order({
    scheduleMode: "FLEXIBLE",
    windowFrom: localInstant("2026-10-10T13:00"),
    windowTo: localInstant("2026-10-10T17:00"),
  });
  assert.deepEqual(codes(o), []);
  assert(
    codes({ ...o, scheduledStart: localInstant("2026-10-10T15:00") }).includes(
      "FLEX_WINDOW",
    ),
  );
  assert(!codes({ ...o, scheduledStart: null }).includes("FLEX_WINDOW"));
});
test("weekly off, outside hours and missing availability are warnings", () => {
  assert(
    codes(order({ scheduledStart: localInstant("2026-10-10T19:00") })).includes(
      "OUTSIDE_HOURS",
    ),
  );
  assert(
    codes(order(), [{ ...cleaner, availability: [] }]).includes(
      "AVAILABILITY_UNKNOWN",
    ),
  );
  assert(
    codes(order(), [
      {
        ...cleaner,
        availability: [
          {
            kind: "WEEKLY",
            weekday: 6,
            date: null,
            startMinute: null,
            endMinute: null,
          },
        ],
      },
    ]).includes("OUTSIDE_HOURS"),
  );
});
test("date exception overrides weekly hours and full/partial date-off is explicit", () => {
  const dated = {
    weekday: null,
    date: new Date("2026-10-10T00:00Z"),
    startMinute: 780,
    endMinute: 1020,
  };
  assert.deepEqual(
    codes(order(), [
      { ...cleaner, availability: [{ ...dated, kind: "AVAILABLE" }] },
    ]),
    [],
  );
  for (const period of [
    { startMinute: null, endMinute: null },
    { startMinute: 900, endMinute: 960 },
  ])
    assert(
      codes(order(), [
        {
          ...cleaner,
          availability: [
            ...cleaner.availability,
            { ...dated, ...period, kind: "UNAVAILABLE" },
          ],
        },
      ]).includes("DATE_OFF"),
    );
});
test("warning acknowledgement changes when shortage or exceptional date changes", () => {
  const a = Service.check(order({ requiredCleaners: 2 }), [cleaner], [])[0],
    b = Service.check(order({ requiredCleaners: 3 }), [cleaner], [])[0];
  assert.notEqual(a.key, b.key);
});
test("Belgrade ranges have 23/25-hour DST days and seven/42-day bounded views", () => {
  for (const [date, hours] of [
    ["2026-03-29", 23],
    ["2026-10-25", 25],
  ] as const) {
    const r = calendarRange("day", date);
    assert.equal((r.to.getTime() - r.from.getTime()) / 3600000, hours);
  }
  assert.equal(calendarRange("week", "2026-10-01").days[0], "2026-09-28");
  assert.equal(calendarRange("month", "2026-10-01").days.length, 42);
  assert.equal(
    localDayStart("2026-10-10").toISOString(),
    "2026-10-09T22:00:00.000Z",
  );
});
test("ambiguous/nonexistent local starts are rejected; duration remains elapsed over DST", () => {
  for (const value of ["2026-03-29T02:30", "2026-10-25T02:30"])
    assert.throws(() => localInstant(value));
  const o = order({
    scheduledStart: localInstant("2026-10-25T01:30"),
    manualDurationMinutes: 180,
  });
  assert.equal(
    plannedEnd(o)!.getTime() - o.scheduledStart!.getTime(),
    10800000,
  );
});
test("schemas reject duplicate assignments and working days with blank hours", () => {
  const p = {
    id: "order",
    expectedUpdatedAt: new Date().toISOString(),
    scheduledStart: "2026-10-10T14:00",
    manualDurationMinutes: 150,
    cleanerIds: ["cleaner", "cleaner"],
  };
  assert(!schedulingSchemas["order-plan"].safeParse(p).success);
  const week = Array.from({ length: 7 }, (_, i) => ({
    weekday: i + 1,
    working: true,
    startMinute: null,
    endMinute: null,
  }));
  assert(
    !schedulingSchemas["availability-week"].safeParse({ id: "cleaner", week })
      .success,
  );
  assert(
    schedulingSchemas["availability-week"].safeParse({
      id: "cleaner",
      week: week.map((r) => ({ ...r, working: false })),
    }).success,
  );
});
