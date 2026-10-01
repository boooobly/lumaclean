import assert from "node:assert/strict";
import { test } from "node:test";
import { localInstant } from "../../src/lib/domain/crm";
import {
  routeKey,
  routeSample,
  routeUsable,
  ROUTING_CONFIG,
  unavailable,
  type RouteRequest,
  type RouteResult,
} from "../../src/lib/domain/routing";
import {
  assessTravel,
  routeIssues,
  preparationRequests,
  AvailabilityService,
  ScheduleOptimizer,
  boundedTeams,
  candidateStarts,
  travelBuffer,
  type RoutingOrder,
  type RoutingSnapshot,
} from "../../src/lib/domain/logistics";
import {
  GoogleRoutesProvider,
  seconds,
} from "../../src/lib/infrastructure/google-routing";
const date = "2026-10-02",
  point = { latitude: 44.81, longitude: 20.46 },
  other = { latitude: 44.84, longitude: 20.5 };
const order = (
  id: string,
  start: string | null,
  extra: Partial<RoutingOrder> = {},
): RoutingOrder => ({
  id,
  addressId: "address",
  updatedAt: "v1",
  reference: id,
  label: id,
  point,
  status: "SCHEDULED",
  scheduleMode: "FIXED",
  scheduledStart: start ? localInstant(date + "T" + start) : null,
  windowFrom: null,
  windowTo: null,
  manualDurationMinutes: 150,
  estimatedDurationMinutes: null,
  requiredCleaners: 1,
  travelBufferMinutes: 30,
  cleaningReserveMinutes: 0,
  cleanerIds: ["a"],
  ...extra,
});
const snapshot = (orders: RoutingOrder[]): RoutingSnapshot => ({
  date,
  version: "v1",
  defaultBuffer: 30,
  orders,
  cleaners: ["a", "b"].map((id, i) => ({
    id,
    name: id,
    active: true,
    updatedAt: "v1",
    home: i ? other : point,
    availability: Array.from({ length: 7 }, (_, j) => ({
      kind: "WEEKLY" as const,
      weekday: j + 1,
      date: null,
      startMinute: 0,
      endMinute: 1440,
    })),
  })),
});
const good = (request: RouteRequest, duration = 42 * 60): RouteResult => ({
  status: "VERIFIED",
  durationSeconds: duration,
  distanceMeters: 2000,
  calculatedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  sampledAt: routeSample(request),
  source: "Google",
});
function table(
  s: RoutingSnapshot,
  targets: RoutingOrder[] = s.orders,
  fn = (r: RouteRequest) => good(r),
) {
  return new Map(
    preparationRequests(s, targets).map((r) => [routeKey(r), fn(r)]),
  );
}
const request: RouteRequest = {
  origin: point,
  destination: other,
  mode: "TRANSIT",
  at: localInstant(date + "T12:31").toISOString(),
};
test("cache key is departure dependent and directional", () => {
  assert.notEqual(
    routeKey(request),
    routeKey({ ...request, at: localInstant(date + "T13:31").toISOString() }),
  );
  assert.notEqual(
    routeKey(request),
    routeKey({ ...request, origin: other, destination: point }),
  );
});
test("cache key separates provider version, mode and arrival timing", () => {
  assert.match(routeKey(request), /^google-v2/);
  assert.notEqual(routeKey(request), routeKey({ ...request, mode: "DRIVE" }));
  assert.notEqual(
    routeKey(request),
    routeKey({ ...request, timing: "arrival" }),
  );
});
test("departure sample rounds forward conservatively", () =>
  assert.equal(
    routeSample(request),
    localInstant(date + "T12:45").toISOString(),
  ));
test("arrival sample rounds backward conservatively", () =>
  assert.equal(
    routeSample({ ...request, timing: "arrival" }),
    localInstant(date + "T12:30").toISOString(),
  ));
test("unavailable has no invented duration", () =>
  assert.equal(unavailable(request).durationSeconds, null));
test("expired routes cannot be used", () =>
  assert.equal(
    routeUsable({ ...good(request), expiresAt: new Date(0).toISOString() }),
    false,
  ));
test("Google duration seconds round upward", () => {
  assert.equal(seconds("42.1s"), 43);
  assert.equal(seconds("not-a-duration"), null);
});
test("A ends 12:30 + 42 travel + 30 buffer gives 13:42", () => {
  const s = snapshot([order("A", "10:00"), order("B", "14:00")]),
    leg = assessTravel(s, table(s)).find((l) => l.orderId === "B")!;
  assert.equal(
    leg.earliestArrival,
    localInstant(date + "T13:42").toISOString(),
  );
  assert.equal(leg.conflict, false);
});
test("late arrival is ERROR", () => {
  const s = snapshot([order("A", "10:00"), order("B", "13:30")]);
  assert.equal(
    routeIssues(assessTravel(s, table(s))).find(
      (i) => i.code === "TRAVEL_TIME_CONFLICT",
    )?.severity,
    "ERROR",
  );
});
test("exact safe arrival is accepted", () => {
  const s = snapshot([order("A", "10:00"), order("B", "13:42")]);
  assert.equal(
    assessTravel(s, table(s)).find((l) => l.orderId === "B")!.conflict,
    false,
  );
});
test("order snapshots and business setting determine buffer", () => {
  assert.equal(
    travelBuffer(
      30,
      order("a", "09:00", { travelBufferMinutes: 45 }),
      order("b", "14:00"),
    ),
    45,
  );
  assert.equal(travelBuffer(60, order("a", "09:00"), order("b", "14:00")), 60);
});
test("first trip has no additional business buffer", () => {
  const s = snapshot([order("A", "09:00")]),
    leg = assessTravel(
      s,
      table(s, undefined, (r) => good(r, 38 * 60)),
    )[0];
  assert.equal(leg.bufferMinutes, 0);
  assert.equal(
    leg.recommendedDeparture,
    localInstant(date + "T08:22").toISOString(),
  );
});
test("home start conflict is ERROR when arrival requires previous-day start", () => {
  const s = snapshot([order("A", "00:15")]);
  assert.equal(
    routeIssues(assessTravel(s, table(s))).find(
      (i) => i.code === "START_LOCATION_CONFLICT",
    )?.severity,
    "ERROR",
  );
});
test("each participant gets independent travel feasibility", () => {
  const s = snapshot([
    order("A", "10:00", { cleanerIds: ["a"] }),
    order("C", "10:00", { cleanerIds: ["b"], point: other }),
    order("B", "14:00", { cleanerIds: ["a", "b"] }),
  ]);
  const t = table(s, undefined, (r) =>
    good(r, r.origin?.latitude === other.latitude ? 65 * 60 : 42 * 60),
  );
  const legs = assessTravel(s, t).filter((l) => l.orderId === "B");
  assert.equal(legs.length, 2);
  assert.equal(legs.find((l) => l.cleanerId === "a")?.conflict, false);
  assert.equal(legs.find((l) => l.cleanerId === "b")?.conflict, true);
  assert.equal(
    routeIssues(legs).filter((i) => i.code === "TRAVEL_TIME_CONFLICT").length,
    1,
  );
});
test("missing coordinates creates ROUTE_UNVERIFIED warning", () => {
  const s = snapshot([order("A", "09:00", { point: null })]);
  assert.equal(
    routeIssues(assessTravel(s, new Map()))[0].code,
    "ROUTE_UNVERIFIED",
  );
});
test("provider failure is warning and no duration", () => {
  const s = snapshot([order("A", "09:00")]),
    t = table(s, undefined, (r) => unavailable(r, "PROVIDER_ERROR"));
  assert.equal(routeIssues(assessTravel(s, t))[0].code, "ROUTE_PROVIDER_ERROR");
});
test("stale cache is visible", () => {
  const s = snapshot([order("A", "09:00")]),
    t = table(s, undefined, (r) => ({
      ...good(r),
      expiresAt: new Date(0).toISOString(),
    }));
  assert.equal(assessTravel(s, t)[0].route.status, "STALE");
});
test("required two cleaners never returns a one-person option", () => {
  const target = order("new", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T17:00"),
      requiredCleaners: 2,
      cleanerIds: [],
    }),
    s = snapshot([]),
    slots = AvailabilityService.findAvailableSlots(
      target,
      s,
      table(s, [target]),
    );
  assert(slots.length);
  assert(slots.every((slot) => slot.cleanerIds.length === 2));
});
test("flexible candidates finish inside promised window", () => {
  const target = order("new", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T17:00"),
    }),
    s = snapshot([]);
  assert(
    candidateStarts(target, s).every(
      (start) =>
        start >= target.windowFrom! &&
        start.getTime() + 150 * 60000 <= target.windowTo!.getTime(),
    ),
  );
});
test("slots validate previous and next routes", () => {
  const target = order("new", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T16:00"),
      manualDurationMinutes: 60,
    }),
    s = snapshot([order("A", "10:00"), order("B", "16:00")]),
    slots = AvailabilityService.findAvailableSlots(
      target,
      s,
      table(s, [target]),
    );
  assert(slots.length);
  assert(slots.every((slot) => slot.legs.every((l) => !l.conflict)));
  assert(slots.some((slot) => slot.legs.some((l) => l.previousId === "new")));
});
test("slots require actual routes", () => {
  const target = order("new", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T17:00"),
    }),
    s = snapshot([]);
  assert.equal(
    AvailabilityService.findAvailableSlots(target, s, new Map()).length,
    0,
  );
});
test("slots respect date exceptions", () => {
  const target = order("new", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T17:00"),
      requiredCleaners: 2,
    }),
    s = snapshot([]);
  s.cleaners[1].availability.push({
    kind: "UNAVAILABLE",
    weekday: null,
    date: new Date(date + "T00:00Z"),
    startMinute: null,
    endMinute: null,
  });
  assert.equal(
    AvailabilityService.findAvailableSlots(target, s, table(s, [target]))
      .length,
    0,
  );
});
test("bounded combinations do not explode for 20 cleaners", () => {
  assert.equal(
    boundedTeams(
      Array.from({ length: 20 }, (_, i) => "c" + i),
      10,
    ).length,
    64,
  );
});
test("candidate count is bounded", () => {
  const target = order("new", null, {
    scheduleMode: "FLEXIBLE",
    windowFrom: localInstant(date + "T00:00"),
    windowTo: localInstant(date + "T23:59"),
    manualDurationMinutes: 1,
  });
  assert(
    candidateStarts(target, snapshot([])).length <= ROUTING_CONFIG.candidates,
  );
});
test("optimizer does not move fixed agreements", () => {
  const fixed = order("fixed", "09:00"),
    flex = order("flex", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T17:00"),
      cleanerIds: [],
    }),
    s = snapshot([fixed, flex]),
    r = ScheduleOptimizer.propose(s, table(s));
  assert.equal(
    r.orders.find((o) => o.id === "fixed")!.scheduledStart?.toISOString(),
    fixed.scheduledStart?.toISOString(),
  );
  assert(r.orders.find((o) => o.id === "flex")?.scheduledStart);
});
test("optimizer is deterministic", () => {
  const flex = order("flex", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T17:00"),
      cleanerIds: [],
    }),
    s = snapshot([flex]),
    t = table(s);
  assert.deepEqual(
    ScheduleOptimizer.propose(s, t),
    ScheduleOptimizer.propose(s, t),
  );
});
test("optimizer prefers less transit while preserving a fixed time", () => {
  const fixed = order("fixed", "12:00", { cleanerIds: [] }),
    s = snapshot([fixed]);
  const routes = table(s, s.orders, (r) =>
    good(r, r.origin?.latitude === point.latitude ? 600 : 3600),
  );
  const result = ScheduleOptimizer.propose(s, routes);
  assert.equal(result.feasible, true);
  assert.deepEqual(result.orders.find((o) => o.id === fixed.id)?.cleanerIds, [
    "a",
  ]);
  assert.equal(
    result.orders.find((o) => o.id === fixed.id)?.scheduledStart?.toISOString(),
    fixed.scheduledStart?.toISOString(),
  );
});
test("optimizer insufficient cleaners explains unplaced order", () => {
  const flex = order("flex", null, {
      scheduleMode: "FLEXIBLE",
      windowFrom: localInstant(date + "T13:00"),
      windowTo: localInstant(date + "T17:00"),
      requiredCleaners: 3,
      cleanerIds: [],
    }),
    s = snapshot([flex]),
    r = ScheduleOptimizer.propose(s, table(s));
  assert(r.unplaced.includes("flex"));
});
test("optimizer cannot fabricate a verified plan", () => {
  const s = snapshot([order("fixed", "09:00")]);
  assert.equal(ScheduleOptimizer.propose(s, new Map()).feasible, false);
});
test("Google matrix enforces 100 transit elements", async () => {
  await assert.rejects(
    new GoogleRoutesProvider("test").getRouteMatrix(
      Array(11).fill(point),
      Array(10).fill(other),
      "TRANSIT",
      request.at,
    ),
  );
});
test("Google matrix request uses TRANSIT, status mask, arrival time", async () => {
  let sent: RequestInit | undefined;
  const mock = async (_url: unknown, init?: RequestInit) => {
    sent = init;
    return new Response(
      JSON.stringify([
        {
          originIndex: 0,
          destinationIndex: 0,
          status: {},
          condition: "ROUTE_EXISTS",
          duration: "2280s",
          distanceMeters: 1500,
        },
      ]),
    );
  };
  const result = await new GoogleRoutesProvider(
    "test-key",
    mock as typeof fetch,
  ).getRouteMatrix([point], [other], "TRANSIT", request.at, "arrival");
  const body = JSON.parse(String(sent!.body));
  assert.equal(body.travelMode, "TRANSIT");
  assert(body.arrivalTime);
  assert(!body.departureTime);
  assert(
    String(
      (sent!.headers as Record<string, string>)["X-Goog-FieldMask"],
    ).includes("status"),
  );
  assert.equal(result[0][0].durationSeconds, 2280);
});
test("Google no route stays unavailable", async () => {
  const mock = async () =>
    new Response(
      JSON.stringify([{ status: {}, condition: "ROUTE_NOT_FOUND" }]),
    );
  const r = await new GoogleRoutesProvider(
    "test",
    mock as typeof fetch,
  ).getTravelTime(request);
  assert.equal(r.status, "NO_ROUTE");
  assert.equal(r.durationSeconds, null);
});
test("Google provider exception does not break CRM", async () => {
  const mock = async () => {
    throw new Error("network");
  };
  const r = await new GoogleRoutesProvider(
    "test",
    mock as typeof fetch,
  ).getTravelTime(request);
  assert.equal(r.status, "PROVIDER_ERROR");
});
test("Google detailed route is on demand and includes walking/transit steps", async () => {
  const mock = async () =>
    new Response(
      JSON.stringify({
        routes: [
          {
            duration: "1800s",
            distanceMeters: 3000,
            legs: [
              {
                steps: [
                  { travelMode: "WALK", staticDuration: "120s" },
                  {
                    travelMode: "TRANSIT",
                    staticDuration: "1200s",
                    transitDetails: {
                      stopDetails: {
                        departureStop: { name: "A" },
                        arrivalStop: { name: "B" },
                      },
                      transitLine: { nameShort: "31" },
                    },
                  },
                ],
              },
            ],
          },
        ],
      }),
    );
  const detail = await new GoogleRoutesProvider(
    "test",
    mock as typeof fetch,
  ).getRouteDetails(request);
  assert.equal(detail.steps.length, 2);
  assert.equal(detail.steps[1].line, "31");
});
