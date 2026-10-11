import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateUpholstery,
  upholsteryDefaults,
  extractorIntervalsConflict,
  upholsteryRequestSchema,
  type UpholsteryRequest,
} from "../../src/lib/upholstery";
import { upholsteryIntent } from "../../src/lib/upholstery-intent";
import { outputAllowed } from "../../src/lib/agent/policy";
const item = (
  type: UpholsteryRequest["items"][number]["type"] = "SOFA3",
  soil: "LIGHT" | "NORMAL" | "HEAVY" = "NORMAL",
) => ({
  type,
  soil,
  quantity: 1,
  fabric: "WET_COMPATIBLE" as const,
  size: "standard",
  material: "confirmed washable fabric",
  notes: "",
});
const quote = (request: UpholsteryRequest) =>
  calculateUpholstery(request, upholsteryDefaults, 1);
test("four owner pricing examples are computed deterministically", () => {
  assert.equal(
    quote({
      mode: "ADDON",
      items: [item("SPOT")],
      cleaning: { service: "regular", area: 55 },
      urgent: false,
    }).total,
    6100,
  );
  assert.equal(
    quote({
      mode: "ADDON",
      items: [item()],
      cleaning: { service: "regular", area: 55 },
      urgent: false,
    }).total,
    7600,
  );
  assert.equal(
    quote({ mode: "STANDALONE", items: [item()], urgent: false }).total,
    3000,
  );
  const light = quote({
    mode: "STANDALONE",
    items: [item("SOFA3", "LIGHT")],
    urgent: false,
  });
  assert.equal(light.itemsSubtotal, 2500);
  assert.equal(light.minimumAdjustment, 500);
  assert.equal(light.total, 3000);
});
test("one standalone stain includes treatment in visit minimum", () => {
  const q = quote({ mode: "STANDALONE", items: [item("SPOT")], urgent: false });
  assert.equal(q.itemsSubtotal, 1500);
  assert.equal(q.minimumAdjustment, 1500);
  assert.equal(q.total, 3000);
  assert.equal(q.deliveryIncluded, true);
  assert.equal(q.lines.length, 1);
});
test("same furniture cannot incur both full cleaning and its stain treatment", () => {
  assert.throws(() =>
    quote({ mode: "ADDON", items: [item(), item("SPOT")], urgent: false }),
  );
  assert.throws(() =>
    quote({
      mode: "ADDON",
      items: [
        { ...item(), objectRef: "sofa" },
        { ...item("SPOT"), objectRef: "sofa" },
      ],
      urgent: false,
    }),
  );
  assert.equal(
    quote({
      mode: "ADDON",
      items: [
        { ...item(), objectRef: "sofa" },
        { ...item("SPOT"), objectRef: "armchair" },
      ],
      urgent: false,
    }).total,
    4500,
  );
});
test("addon has no standalone floor or second equipment charge", () => {
  const q = quote({ mode: "ADDON", items: [item("SPOT")], urgent: false });
  assert.equal(q.total, 1500);
  assert.equal(q.minimumAdjustment, 0);
  assert.equal(
    quote({ mode: "ADDON", items: [item()], urgent: false }).total,
    3000,
  );
});
test("quantities and seating places remain item based", () => {
  const q = quote({
    mode: "STANDALONE",
    items: [
      { ...item("CORNER"), quantity: 2, seats: 4 },
      { ...item("CHAIR"), quantity: 3 },
    ],
    urgent: false,
  });
  assert.equal(q.total, 8700);
  assert.equal(q.lines[0].units, 8);
});
test("heavy soiling requires photo and final price review", () => {
  const q = quote({
    mode: "STANDALONE",
    items: [item("SOFA3", "HEAVY")],
    urgent: false,
  });
  assert.equal(q.total, 3800);
  assert.equal(q.from, true);
  assert(q.reviewReasons.includes("PHOTO_PRICE_REVIEW"));
  assert.equal(q.autonomousBooking, false);
});
test("unknown and unsafe materials cannot imply booking readiness", () => {
  for (const fabric of ["UNKNOWN", "UNSAFE"] as const) {
    const q = quote({
      mode: "STANDALONE",
      items: [{ ...item(), fabric }],
      urgent: false,
    });
    assert.equal(q.bookingRequiresHumanReview, true);
    assert.equal(q.materialRejected, fabric === "UNSAFE");
    assert(
      q.reviewReasons.includes(
        fabric === "UNSAFE" ? "MATERIAL_UNSAFE" : "MATERIAL_UNKNOWN",
      ),
    );
  }
});
test("urgent surcharge is the shared existing twenty percent rule", () => {
  const q = quote({
    mode: "ADDON",
    items: [item()],
    cleaning: { service: "regular", area: 55 },
    urgent: true,
  });
  assert.equal(q.subtotal, 7600);
  assert.equal(q.surcharge, 1500);
  assert.equal(q.total, 9100);
});
test("admin catalogue is configurable without altering earlier snapshots", () => {
  const a = quote({ mode: "STANDALONE", items: [item()], urgent: false }),
    b = calculateUpholstery(
      { mode: "STANDALONE", items: [item()], urgent: false },
      { ...upholsteryDefaults, sofa3Normal: 3500 },
      2,
    );
  assert.equal(a.total, 3000);
  assert.equal(a.version, 1);
  assert.equal(b.total, 3500);
  assert.equal(b.version, 2);
});
test("shape rejects square matrix misuse and invalid corner quantity", () => {
  assert.throws(() =>
    upholsteryRequestSchema.parse({
      mode: "STANDALONE",
      items: [item()],
      urgent: false,
      cleaning: { service: "regular", area: 55 },
    }),
  );
  assert.throws(() =>
    quote({ mode: "STANDALONE", items: [item("CORNER")], urgent: false }),
  );
});
test("extractor intervals include equipment transport buffer", () => {
  const a = {
      start: new Date("2026-10-13T12:30Z"),
      end: new Date("2026-10-13T13:30Z"),
      transferMinutes: 30,
    },
    b = {
      start: new Date("2026-10-13T13:45Z"),
      end: new Date("2026-10-13T14:45Z"),
      transferMinutes: 15,
    };
  assert(extractorIntervalsConflict(a, b));
  assert(
    !extractorIntervalsConflict(a, {
      ...b,
      start: new Date("2026-10-13T14:00Z"),
    }),
  );
});
test("inquiry detection supports RU SR EN and keeps apartment deep cleaning separate", () => {
  for (const text of [
    "Сколько стоит химчистка дивана?",
    "Вы можете взять моющий пылесос на генеральную уборку?",
    "Koliko košta dubinsko pranje troseda?",
    "Treba mi pranje kauča i redovno čišćenje stana",
    "Can you clean a sofa stain?",
  ])
    assert(upholsteryIntent(text), text);
  assert(!upholsteryIntent("Treba mi generalno čišćenje stana"));
});
test("AI output permits computed amounts and rejects invented price or duration", () => {
  const upholsteryQuote = quote({
      mode: "STANDALONE",
      items: [item()],
      urgent: false,
    }),
    state = { upholsteryInquiry: true, upholsteryQuote };
  assert(
    outputAllowed(
      "Стоимость 3 000 RSD. Материал и срок уточнит администратор.",
      state,
    ),
  );
  assert(!outputAllowed("Стоимость 2 700 RSD.", state));
  assert(!outputAllowed("Высохнет за 2 часа.", state));
  assert(!outputAllowed("Booking confirmed.", state));
});
