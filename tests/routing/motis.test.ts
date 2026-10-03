import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "../../src/generated/prisma/client";
import {
  MotisRoutingProvider,
  conservativeRoute,
} from "../../src/lib/infrastructure/motis-routing";
import { RoutingService } from "../../src/lib/services/route-cache";
import {
  routeKey,
  type RouteRequest,
  type RouteResult,
} from "../../src/lib/domain/routing";
import { decodeRouteGeometry } from "../../src/lib/domain/route-geometry";
import {
  assessTravel,
  preparationRequests,
  AvailabilityService,
  ScheduleOptimizer,
  type RoutingSnapshot,
  type RoutingOrder,
} from "../../src/lib/domain/logistics";
import { localInstant } from "../../src/lib/domain/crm";
import {
  normalizeAddress,
  normalizeHome,
  signLocation,
} from "../../src/lib/services/google-places";
const p = { latitude: 44.81, longitude: 20.46 },
  q = { latitude: 44.84, longitude: 20.5 },
  r: RouteRequest = {
    origin: p,
    destination: q,
    mode: "TRANSIT",
    at: "2026-10-05T07:31:00Z",
  };
const token = "test-only-" + "a".repeat(64),
  now = Date.parse("2026-10-03T08:00:00Z");
const status = (version = "v1", usable = false) => ({
  engine: { healthy: true },
  static: { valid: true, datasets: [] },
  realtime: {
    status: "FRESH",
    usable,
    licenseConfirmed: true,
    timestamp: now / 1000,
  },
  dataVersion: version,
  thresholds: { maxAgeSeconds: 120 },
});
test("adapter uses server token, bounded endpoints, geocode and reverse", async () => {
  const seen: string[] = [];
  const http = async (url: URL | RequestInfo, options?: RequestInit) => {
    assert.equal(
      (options?.headers as Record<string, string>).Authorization,
      "Bearer " + token,
    );
    seen.push(String(url));
    return Response.json({
      results: [
        { id: "node/[123]", displayAddress: "Terazije 1, Beograd", ...p },
      ],
    });
  };
  const provider = new MotisRoutingProvider(
    "https://routing.example",
    token,
    http as typeof fetch,
    () => new Date(now),
  );
  assert.equal(
    (await provider.searchAddress("Terazije 1"))[0].id,
    "node/[123]",
  );
  assert.equal((await provider.reverseGeocode(p))[0].latitude, 44.81);
  assert(seen[0].includes("/geocode?q=Terazije%201"));
  assert(seen[1].includes("/reverse-geocode?latitude=44.81"));
  await assert.rejects(
    provider.getRouteMatrix(
      Array(11).fill(p),
      Array(10).fill(q),
      "TRANSIT",
      r.at,
    ),
    /MATRIX_TOO_LARGE/,
  );
});
test("network and invalid responses give 80, never unresolved coordinates a fabricated route", async () => {
  for (const http of [
    async () => {
      throw Error("offline");
    },
    async () => Response.json({ durationSeconds: 20 }),
  ]) {
    const provider = new MotisRoutingProvider(
      "https://routing.example",
      token,
      http as typeof fetch,
      () => new Date(now),
    );
    assert.equal((await provider.getTravelTime(r)).durationSeconds, 4800);
    assert.equal(
      (await provider.getTravelTime({ ...r, origin: null })).quality,
      "UNRESOLVED",
    );
    assert.equal(
      (
        await provider.getTravelTime({
          ...r,
          destination: { latitude: 0, longitude: 0 },
        })
      ).quality,
      "UNRESOLVED",
    );
    assert.equal(
      (await provider.getTravelTime({ ...r, mode: "WALK" })).quality,
      "UNRESOLVED",
    );
  }
});
test("adapter rejects LIVE when health is stale or incompatible and accepts walking without RT", async () => {
  for (const liveReady of [true, false]) {
    const value: RouteResult = {
      ...conservativeRoute(r, new Date(now), "v1"),
      quality: "LIVE",
      durationSeconds: 900,
      expiresAt: new Date(now + 60000).toISOString(),
    };
    const http = async (url: URL | RequestInfo) =>
      Response.json(
        String(url).endsWith("/datasets/status")
          ? status("v1", liveReady)
          : value,
      );
    const provider = new MotisRoutingProvider(
      "https://routing.example",
      token,
      http as typeof fetch,
      () => new Date(now),
    );
    assert.equal(
      (await provider.getTravelTime(r)).quality,
      liveReady ? "LIVE" : "FALLBACK_80",
    );
  }
  const walking = {
    ...conservativeRoute(r, new Date(now)),
    quality: "WALKING",
    durationSeconds: 700,
    expiresAt: new Date(now + 1800000).toISOString(),
  };
  assert.equal(
    (
      await new MotisRoutingProvider(
        "https://routing.example",
        token,
        async () => Response.json(walking),
        () => new Date(now),
      ).getTravelTime(r)
    ).quality,
    "WALKING",
  );
});
test("RouteCalculation caches quality/version and avoids repeated matrix calls", async () => {
  let time = now,
    version = "v1",
    calls = 0;
  const rows: Record<string, unknown>[] = [];
  const http = async (url: URL | RequestInfo, init?: RequestInit) => {
    if (String(url).endsWith("/datasets/status"))
      return Response.json(status(version));
    calls++;
    const body = JSON.parse(String(init?.body));
    return Response.json({
      rows: body.origins.map((origin: typeof p) =>
        body.destinations.map((destination: typeof p) =>
          conservativeRoute(
            { ...r, origin, destination },
            new Date(time),
            version,
          ),
        ),
      ),
    });
  };
  const db = {
    routeCalculation: {
      findMany: async ({ where }: { where: { cacheKey: { in: string[] } } }) =>
        rows.filter((row) =>
          where.cacheKey.in.includes(row.cacheKey as string),
        ),
    },
    $executeRaw: async (_s: unknown, data: string) => {
      for (const row of JSON.parse(data)) {
        rows.push({
          ...row,
          departureAt: new Date(row.departureAt),
          calculatedAt: new Date(row.calculatedAt),
          expiresAt: new Date(row.expiresAt),
        });
      }
      return 1;
    },
  } as unknown as Prisma.TransactionClient;
  const service = new RoutingService(
    db,
    new MotisRoutingProvider(
      "https://routing.example",
      token,
      http as typeof fetch,
      () => new Date(time),
    ),
  );
  // Keep database comparisons in the same real clock domain.
  time = Date.now();
  const a = await service.getTravelTime(r);
  assert.equal(a.quality, "FALLBACK_80");
  await service.getTravelTime(r);
  assert.equal(calls, 1);
  assert.match(rows[0].cacheKey as string, /v1\|FALLBACK_80$/);
  version = "v2";
  time += 11000;
  await service.getTravelTime(r);
  assert.equal(calls, 2);
  assert.match(rows[1].cacheKey as string, /v2\|FALLBACK_80$/);
});
const date = "2026-10-05";
const order = (
  id: string,
  start: string,
  extra: Partial<RoutingOrder> = {},
): RoutingOrder => ({
  id,
  addressId: "address",
  updatedAt: "v1",
  reference: id,
  label: id,
  point: p,
  status: "SCHEDULED",
  scheduleMode: "FIXED",
  scheduledStart: localInstant(date + "T" + start),
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
    home: i ? q : p,
    availability: Array.from({ length: 7 }, (_, j) => ({
      kind: "WEEKLY",
      weekday: j + 1,
      date: null,
      startMinute: 0,
      endMinute: 1440,
    })),
  })),
});
const matrix = (
  s: RoutingSnapshot,
  fn = (request: RouteRequest) => conservativeRoute(request),
) =>
  new Map(
    preparationRequests(s, s.orders).map((request) => [
      routeKey(request),
      fn(request),
    ]),
  );
test("80 + 30 between jobs uses actual end minute, first trip has no 30", () => {
  const s = snapshot([order("A", "10:07"), order("B", "15:00")]);
  const legs = assessTravel(s, matrix(s));
  assert.equal(legs[0].bufferMinutes, 0);
  assert.equal(
    legs[0].recommendedDeparture,
    localInstant(date + "T08:47").toISOString(),
  );
  assert.equal(
    legs[1].earliestArrival,
    localInstant(date + "T14:27").toISOString(),
  );
});
test("two cleaners wait for the latest participant; optimizer stays deterministic", () => {
  const s = snapshot([
    order("A", "10:07"),
    order("C", "10:22", { cleanerIds: ["b"] }),
    order("B", "14:30", { cleanerIds: ["a", "b"], requiredCleaners: 2 }),
  ]);
  const legs = assessTravel(s, matrix(s)).filter((l) => l.orderId === "B");
  assert.equal(legs.length, 2);
  assert.equal(legs.find((l) => l.cleanerId === "a")?.conflict, false);
  assert.equal(legs.find((l) => l.cleanerId === "b")?.conflict, true);
  assert.equal(ScheduleOptimizer.propose(s, matrix(s)).feasible, false);
  assert.deepEqual(
    ScheduleOptimizer.propose(s, matrix(s)),
    ScheduleOptimizer.propose(s, matrix(s)),
  );
});
test("unresolved address never produces automatic slots", () => {
  const target = order("new", "14:00", { point: null, cleanerIds: [] }),
    s = snapshot([target]);
  assert.equal(
    AvailabilityService.findAvailableSlots(target, s, matrix(s)).length,
    0,
  );
});
test("signed selected coordinates persist confirmation and address changes clear it", () => {
  const before = process.env.BETTER_AUTH_SECRET;
  process.env.BETTER_AUTH_SECRET = token;
  try {
    const proof = signLocation({
      address: "Terazije 1, Beograd",
      placeId: "user-confirmed:test",
      ...p,
      expires: Date.now() + 86400000,
    });
    assert.equal(
      (
        normalizeAddress({
          fullAddress: "Terazije 1, Beograd",
          locationProof: proof,
        }) as { coordinatesConfirmed?: boolean }
      ).coordinatesConfirmed,
      true,
    );
    assert.equal(
      (
        normalizeHome({
          homeAddress: "Terazije 1, Beograd",
          homeLocationProof: proof,
        }) as { homeCoordinatesConfirmed?: boolean }
      ).homeCoordinatesConfirmed,
      true,
    );
    assert.equal(
      (
        normalizeAddress(
          { fullAddress: "New address" },
          { fullAddress: "Old address" },
        ) as { coordinatesConfirmed?: boolean }
      ).coordinatesConfirmed,
      false,
    );
  } finally {
    if (before === undefined) delete process.env.BETTER_AUTH_SECRET;
    else process.env.BETTER_AUTH_SECRET = before;
  }
});
test("real MOTIS precision-6 geometry displays in Belgrade", () => {
  const points = decodeRouteGeometry("cmcntAgkz_f@LG", 6);
  assert(Math.abs(points[0][1] - 44.8125) < 0.001);
  assert(Math.abs(points[0][0] - 20.4612) < 0.001);
});

test("failed health snapshots are coalesced and cached briefly", async () => {
  let calls = 0;
  let clock = now;
  const provider = new MotisRoutingProvider(
    "https://routing.example",
    token,
    (async () => {
      calls++;
      throw Error("offline");
    }) as typeof fetch,
    () => new Date(clock),
  );
  await Promise.all([provider.cacheContext(), provider.cacheContext()]);
  await provider.cacheContext();
  assert.equal(calls, 1);
  clock += 10001;
  await provider.cacheContext();
  assert.equal(calls, 2);
});

test("MOTIS house-number results without upstream IDs get stable distinct IDs", async () => {
  const provider = new MotisRoutingProvider("https://routing.example", token, async () => Response.json({results:[{id:"",displayAddress:"House 8, Beograd",...p},{id:"",displayAddress:"House 8a, Beograd",...q}]}));
  const a=await provider.searchAddress("House 8"), b=await provider.searchAddress("House 8");
  assert.match(a[0].id,/^motis-address:[a-f0-9]{64}$/); assert.equal(a[0].id,b[0].id); assert.notEqual(a[0].id,a[1].id); assert.deepEqual({latitude:a[0].latitude,longitude:a[0].longitude},p);
});

test("static ETA 34 or 200 never proves hard feasibility: end 12 + 80 + 30 = 13:50", () => {
  for(const eta of [34,200])for(const start of ["13:30","14:00"]){
    const s=snapshot([order("A","09:30"),order("B",start)]);
    const table=matrix(s,request=>({...conservativeRoute(request),quality:"STATIC_CANDIDATE",durationSeconds:eta*60}));
    const leg=assessTravel(s,table).find(l=>l.orderId==="B")!;
    assert.equal(leg.earliestArrival,localInstant(date+"T13:50").toISOString());assert.equal(leg.conflict,start==="13:30");assert.equal(leg.route.durationSeconds,4800);
    assert.equal(AvailabilityService.findAvailableSlots(s.orders[1],{...s,orders:[s.orders[0]],cleaners:[s.cleaners[0]]},table).length>0,start==="14:00");
  }
});

test("two fallback participants arriving 13:40 and 14:10 reject 14:00",()=>{
  const s=snapshot([order("A","09:20"),order("C","09:50",{cleanerIds:["b"]}),order("B","14:00",{cleanerIds:["a","b"],requiredCleaners:2})]);
  const table=matrix(s), legs=assessTravel(s,table).filter(l=>l.orderId==="B");
  assert.equal(legs.find(l=>l.cleanerId==="a")?.earliestArrival,localInstant(date+"T13:40").toISOString());
  assert.equal(legs.find(l=>l.cleanerId==="b")?.earliestArrival,localInstant(date+"T14:10").toISOString());
  assert.equal(AvailabilityService.findAvailableSlots(s.orders[2],{...s,orders:s.orders.slice(0,2)},table).length,0);
});

test("critical slot revalidation forwards forceFresh and replaces a cached short duration", async()=>{
  let fresh=false;
  const old={...conservativeRoute(r),quality:"LIVE_EXTERNAL" as const,source:"BusMaps" as const,durationSeconds:60};
  const provider:import("../../src/lib/domain/routing").RoutingProvider={getTravelTime:async()=>old,getRouteDetails:async()=>({result:old,steps:[]}),getRouteMatrix:async()=>[[old]],verifyCritical:async(request,options)=>{fresh=options?.forceFresh===true;return conservativeRoute(request);}};
  const result=await new RoutingService({} as Prisma.TransactionClient,provider).prepareCritical([r],{forceFresh:true,table:new Map([[routeKey(r),old]])});
  assert(fresh);assert.equal(result.get(routeKey(r))?.durationSeconds,4800);
});
