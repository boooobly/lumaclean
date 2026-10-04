import test from "node:test";
import assert from "node:assert/strict";
import type { RouteRequest, RouteResult, RoutingProvider } from "@/lib/domain/routing";
import { parseBusMaps, type TransitObservation } from "@/lib/infrastructure/busmaps-contract";
import { BusMapsTransitProvider, busMapsKey, busMapsPeriod, type BusMapsStore, type UsageCounter } from "@/lib/infrastructure/busmaps-transit";
import { HybridRoutingProvider } from "@/lib/infrastructure/hybrid-routing";
import { conservativeRoute } from "@/lib/infrastructure/motis-routing";

const now = new Date("2026-10-03T08:00:00Z");
process.env.BUSMAPS_STATUS="ACTIVE";
const request: RouteRequest = {
  origin: { latitude: 44.8125, longitude: 20.4612 },
  destination: { latitude: 44.83, longitude: 20.4 },
  mode: "TRANSIT", at: now.toISOString(), timing: "departure",
};
function fixture(live = true) {
  return { routes: [{ duration: 900, walkingDuration: 300, transfers: 0, sections: [
    { id: "walk", type: "pedestrian", travelSummary: { duration: 300 },
      departure: { time: "2026-10-03T10:00:00+02:00" },
      arrival: { time: "2026-10-03T10:05:00+02:00", rtArrival: undefined as string | undefined } },
    { id: "bus", type: "transit", travelSummary: { duration: 600 },
      departure: { time: "2026-10-03T10:05:00+02:00", ...(live ? { rtDeparture: "2026-10-03T10:08:00+02:00" } : {}) },
      arrival: { time: "2026-10-03T10:15:00+02:00", ...(live ? { rtArrival: "2026-10-03T10:18:00+02:00" } : {}) },
      transport: { mode: "bus", shortName: "31" } },
  ] }] };
}
class MemoryStore implements BusMapsStore {
  entries = new Map<string, TransitObservation>();
  leases = new Map<string, string>();
  requests = new Map<string, number>();
  counts: Partial<Record<UsageCounter, number>> = {};
  async cached(key: string, at: Date) {
    const value = this.entries.get(key);
    return value && Date.parse(value.expiresAt) > at.getTime() ? value : null;
  }
  async save(key: string, _r: RouteRequest, value: TransitObservation) { this.entries.set(key, value); }
  async reserve(period: string, limit: number) {
    const used = this.requests.get(period) ?? 0;
    if (used >= limit) return false;
    this.requests.set(period, used + 1); return true;
  }
  async count(_period: string, counter: UsageCounter) { this.counts[counter] = (this.counts[counter] ?? 0) + 1; }
  async acquire(key: string, owner: string) {
    if (this.leases.has(key)) return false;
    this.leases.set(key, owner); return true;
  }
  async release(key: string, owner: string) { if (this.leases.get(key) === owner) this.leases.delete(key); }
}
test("official RT fields prove LIVE; delay and waiting are included in seconds", () => {
  const value = parseBusMaps(fixture(), request, now);
  assert.equal(value.status, "LIVE");
  assert.equal(value.durationSeconds, 1080);
  assert.equal(value.walkingSeconds, 300);
  assert.equal(value.steps[1].line, "31");
  assert.equal(Date.parse(value.expiresAt) - now.getTime(), 120000);
});
test("scheduled routes and a partially realtime transit leg never become LIVE", () => {
  assert.equal(parseBusMaps(fixture(false), request, now).status, "SCHEDULE_ONLY");
  const partial = fixture();
  delete partial.routes[0].sections[1].arrival.rtArrival;
  assert.equal(parseBusMaps(partial, request, now).status, "SCHEDULE_ONLY");
});
test("cancellations, service alerts, invalid chronology and missed deadlines are rejected", () => {
  const canceled = { ...fixture(), alerts: [{ effect: "NO_SERVICE", sectionIds: "bus" }] };
  assert.equal(parseBusMaps(canceled, request, now).status, "UNAVAILABLE");
  const reversed = fixture();
  reversed.routes[0].sections[1].arrival.rtArrival = "2026-10-03T10:01:00+02:00";
  assert.equal(parseBusMaps(reversed, request, now).status, "UNAVAILABLE");
  assert.equal(parseBusMaps(fixture(), { ...request, timing: "arrival", at: "2026-10-03T08:15:00Z" }, now).status, "UNAVAILABLE");
  assert.equal(parseBusMaps(fixture(), { ...request, at: "2026-10-03T08:10:00Z" }, now).status, "UNAVAILABLE");
});
test("arrival requests use actual first departure and leave conservative deadline padding", () => {
  assert.equal(parseBusMaps(fixture(), { ...request, timing: "arrival", at: "2026-10-03T08:20:00Z" }, now).durationSeconds, 1020);
  assert.throws(() => parseBusMaps({ routes: Array(25).fill(fixture().routes[0]) }, request, now));
});
test("API key stays in required headers, never in URL or persisted observations", async () => {
  const store = new MemoryStore();
  const provider = new BusMapsTransitProvider(store, " private-test-key ", (async (url, init) => {
    const u = new URL(String(url));
    assert.equal(u.origin, "https://capi.busmaps.com:8443");
    assert.equal(u.pathname, "/v1/routes");
    assert.equal(u.searchParams.get("arrivalTime"), request.at);
    assert.equal(u.searchParams.has("departureTime"), false);
    assert.equal((init?.headers as Record<string, string>)["capi-key"], "Bearer private-test-key");
    assert.equal(String(url).includes("private-test-key"), false);
    return Response.json(fixture());
  }) as typeof fetch, () => now);
  await provider.inspect({ ...request, timing: "arrival" });
  assert.equal(JSON.stringify([...store.entries]).includes("private-test-key"), false);
  assert.equal(provider.cacheIdentity.includes("private-test-key"), false);
});
test("missing key and coordinates cause zero HTTP requests", async () => {
  const http = (async () => { assert.fail("HTTP must not be called"); }) as typeof fetch;
  const store = new MemoryStore();
  assert.equal((await new BusMapsTransitProvider(store, "", http, () => now).verify(request)).reason, "BUSMAPS_NOT_CONFIGURED");
  assert.equal((await new BusMapsTransitProvider(store, "test", http, () => now).verify({ ...request, origin: null })).reason, "COORDINATES_REQUIRED");
  assert.equal(store.requests.size, 0);
});
test("PENDING_APPROVAL is an optional fallback, never an HTTP error or quota request",async()=>{
  const store=new MemoryStore();
  const pending=new BusMapsTransitProvider(store,"inactive-fixture-key",(async()=>assert.fail("Pending account must not receive requests")) as typeof fetch,()=>now,1000,"PENDING_APPROVAL");
  assert.equal(pending.configured,false);
  const result=await pending.verify(request);
  assert.equal(result.reason,"BUSMAPS_PENDING_APPROVAL");
  assert.equal(store.requests.size,0);
  assert.equal(store.counts.errors??0,0);
  assert.equal((await new HybridRoutingProvider(motis(),pending).getTravelTime(request)).durationSeconds,4800);
});
test("short cache saves quota; forceFresh spends one new request and replaces cached result", async () => {
  let clock = now, calls = 0;
  const store = new MemoryStore();
  const provider = new BusMapsTransitProvider(store, "test", (async () => { calls++; return Response.json(fixture()); }) as typeof fetch, () => clock);
  await provider.inspect(request); await provider.inspect(request);
  assert.equal(calls, 1); assert.equal(store.counts.cacheHits, 1);
  await provider.inspect(request, true); assert.equal(calls, 2);
  clock = new Date(now.getTime() + 120001);
  await provider.inspect(request); assert.equal(calls, 3);
});
test("parallel equal requests spend one quota unit; different legs stop at monthly cap", async () => {
  let calls = 0;
  const store = new MemoryStore();
  const provider = new BusMapsTransitProvider(store, "test", (async () => { calls++; return Response.json(fixture()); }) as typeof fetch, () => now, 3);
  await Promise.all(Array.from({ length: 20 }, () => provider.inspect(request)));
  assert.equal(calls, 1);
  const values = await Promise.all(Array.from({ length: 10 }, (_, i) => provider.inspect({ ...request, destination: { latitude: 44.82 + i / 1000, longitude: 20.41 } })));
  assert.equal(calls, 3);
  assert.equal(store.requests.get(busMapsPeriod(now)), 3);
  assert.equal(values.filter(v => v.reason === "MONTHLY_LIMIT_REACHED").length, 8);
});
test("persistent lease coalesces equal requests across provider instances", async () => {
  let calls = 0;
  const store = new MemoryStore();
  const http = (async () => { calls++; return Response.json(fixture()); }) as typeof fetch;
  const a = new BusMapsTransitProvider(store, "test", http, () => now);
  const b = new BusMapsTransitProvider(store, "test", http, () => now);
  const result = await Promise.all([a.inspect(request), b.inspect(request)]);
  assert.equal(result.every(v => v.status === "LIVE"), true);
  assert.equal(calls, 1); assert.equal(store.leases.size, 0);
});
test("429, timeout, malformed and oversized responses retain usage and hide failure details", async () => {
  for (const http of [
    async () => new Response("quota", { status: 429 }),
    async () => { throw new DOMException("private-test-key", "TimeoutError"); },
    async () => Response.json({ routes: "malformed" }),
    async () => new Response("x".repeat(1024 * 1024 + 1)),
  ]) {
    const store = new MemoryStore();
    const value = await new BusMapsTransitProvider(store, "private-test-key", http as typeof fetch, () => now).verify(request);
    assert.equal(value.status, "UNAVAILABLE");
    assert.equal(store.requests.get(busMapsPeriod(now)), 1);
    assert.equal(store.counts.errors, 1); assert.equal(store.counts.fallbackLegs, 1);
    assert.equal(JSON.stringify(value).includes("private-test-key"), false);
    assert.equal(store.leases.size, 0);
  }
});
test("quota buckets use Belgrade month; cache identity separates time, direction and key", () => {
  assert.equal(busMapsPeriod(new Date("2026-09-30T22:01:00Z")), "BUSMAPS:2026-10");
  const key = busMapsKey(request, "a");
  assert.notEqual(key, busMapsKey({ ...request, timing: "arrival" }, "a"));
  assert.notEqual(key, busMapsKey({ ...request, at: "2026-10-03T08:00:01Z" }, "a"));
  assert.notEqual(key, busMapsKey(request, "b"));
});
function motis(result = conservativeRoute(request, now)): RoutingProvider {
  return {
    cacheContext: async () => ({ dataVersion: "m1", liveReady: false }),
    getTravelTime: async () => result,
    getRouteMatrix: async (a, b) => a.map(() => b.map(() => result)),
    getRouteDetails: async () => ({ result, steps: [] }),
  };
}
test("hybrid verifies only explicit critical legs, never its optimizer matrix", async () => {
  let calls = 0;
  const external = new BusMapsTransitProvider(new MemoryStore(), "test", (async () => { calls++; return Response.json(fixture()); }) as typeof fetch, () => now);
  const hybrid = new HybridRoutingProvider(motis(), external);
  await hybrid.getRouteMatrix([request.origin!], [request.destination!], "TRANSIT", request.at);
  await hybrid.getCandidateMatrix([request.origin!], [request.destination!], "TRANSIT", request.at);
  assert.equal(calls, 0);
  assert.equal((await hybrid.verifyCritical(request)).quality, "LIVE_EXTERNAL");
  assert.equal(calls, 1);
});
test("hybrid preserves walking, blocks unresolved coordinates, and scheduled-only uses owner fallback", async () => {
  let calls = 0;
  const external = new BusMapsTransitProvider(new MemoryStore(), "test", (async () => { calls++; return Response.json(fixture(false)); }) as typeof fetch, () => now);
  const walking: RouteResult = { ...conservativeRoute(request, now), quality: "WALKING", durationSeconds: 600 };
  assert.equal((await new HybridRoutingProvider(motis(walking), external).getTravelTime(request)).quality, "WALKING");
  assert.equal(calls, 0);
  const hybrid = new HybridRoutingProvider(motis(), external, 90);
  const value = await hybrid.verifyCritical(request);
  assert.equal(value.quality, "FALLBACK_80"); assert.equal(value.durationSeconds, 5400);
  assert.equal((await hybrid.verifyCritical({ ...request, origin: null }, { base: walking })).quality, "UNRESOLVED");
  assert.equal(calls, 1);
});
test("static candidates never leave critical verifier; final fresh check discards cached base", async () => {
  const external = new BusMapsTransitProvider(new MemoryStore(), "", fetch, () => now);
  const hybrid = new HybridRoutingProvider(motis(), external);
  const base: RouteResult = { ...conservativeRoute(request, now), quality: "STATIC_CANDIDATE", durationSeconds: 60 };
  assert.equal((await hybrid.verifyCritical(request, { base })).quality, "FALLBACK_80");
  assert.equal((await hybrid.verifyCritical(request, { base: { ...base, quality: "WALKING" }, forceFresh: true })).quality, "FALLBACK_80");
});
