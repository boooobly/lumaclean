import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import {
  authorized,
  Limits,
  selectJourney,
  transitReady,
  matrixSchema,
} from "../core.mjs";
import { rtMetrics, decodeRt, validateGtfs } from "../datasets.mjs";
import { createGateway } from "../server.mjs";
import Gtfs from "gtfs-realtime-bindings";
import AdmZip from "adm-zip";
const now = Date.parse("2026-10-03T08:00:00Z"),
  at = new Date(now).toISOString(),
  point = { latitude: 44.81, longitude: 20.46 };
const request = {
  origin: point,
  destination: { latitude: 44.84, longitude: 20.4 },
  mode: "TRANSIT",
  at,
  timing: "departure",
};
const index = {
  id: "bgu",
  trips: new Map([["t", "r"]]),
  routes: new Set(["r"]),
  stops: new Set(["a", "b"]),
};
const feed = {
  header: { gtfsRealtimeVersion: "2.0", timestamp: now / 1000 },
  entity: [
    {
      id: "e",
      tripUpdate: {
        trip: { tripId: "t", routeId: "r", startDate: "20261003" },
        timestamp: now / 1000,
        stopTimeUpdate: [
          { stopId: "a", arrival: { delay: 30 } },
          { stopId: "b", departure: { delay: 30 } },
        ],
      },
    },
  ],
};
const realtime = () =>
  rtMetrics(feed, [index], { licenseConfirmed: true }, now);
const status = () => ({
  engine: { healthy: true },
  static: { valid: true, datasets: [] },
  realtime: realtime(),
  dataVersion: "v1",
  thresholds: { maxAgeSeconds: 120 },
});
const transit = {
  duration: 1200,
  startTime: new Date(now + 300000).toISOString(),
  endTime: new Date(now + 1500000).toISOString(),
  legs: [
    {
      mode: "BUS",
      realTime: true,
      tripId: "bgu_t",
      startTime: at,
      duration: 1200,
      distance: 4000,
    },
  ],
};
const walking = {
  duration: 1800,
  legs: [{ mode: "WALK", duration: 1800, distance: 1500 }],
};
test("auth compares token; short and anonymous credentials rejected", () => {
  assert(authorized("Bearer " + "a".repeat(64), "a".repeat(64)));
  assert(!authorized(undefined, "a".repeat(64)));
  assert(!authorized("Bearer " + "b".repeat(64), "a".repeat(64)));
  assert(!authorized("Bearer short", "short"));
});
test("bounds, Cartesian size, rate and concurrency are enforced", () => {
  assert(
    !matrixSchema.safeParse({
      origins: Array(11).fill(point),
      destinations: Array(10).fill(point),
      mode: "TRANSIT",
      at,
    }).success,
  );
  assert(
    !matrixSchema.safeParse({
      origins: [{ latitude: 0, longitude: 0 }],
      destinations: [point],
      mode: "TRANSIT",
      at,
    }).success,
  );
  const l = new Limits({ concurrency: 1, perMinute: 2 });
  assert(l.enter(now));
  assert(!l.enter(now));
  l.leave();
  assert(l.enter(now));
  l.leave();
  assert(!l.enter(now));
  assert(l.enter(now + 60000));
});
test("real protobuf TripUpdates decode and match IDs, source, service date", () => {
  const bytes = Gtfs.transit_realtime.FeedMessage.encode(
    Gtfs.transit_realtime.FeedMessage.fromObject(feed),
  ).finish();
  const m = rtMetrics(
    decodeRt(bytes),
    [index],
    { licenseConfirmed: true },
    now,
  );
  assert(m.usable);
  assert.equal(m.percentageUsable, 100);
  assert.equal(m.tripMatchRatio, 1);
  assert.deepEqual(m.usableTripIds, ["bgu_t"]);
  assert.equal(m.usableTrips[0].date, "2026-10-03");
});
test("unconfirmed license, stale, route mismatch and unknown stop fail closed", () => {
  assert(!rtMetrics(feed, [index], {}, now).usable);
  assert(
    !rtMetrics(feed, [index], { licenseConfirmed: true }, now + 121000).usable,
  );
  for (const field of ["route", "stop", "trip"]) {
    const f = structuredClone(feed);
    if (field === "route") f.entity[0].tripUpdate.trip.routeId = "bad";
    if (field === "trip") f.entity[0].tripUpdate.trip.tripId = "bad";
    if (field === "stop")
      f.entity[0].tripUpdate.stopTimeUpdate[0].stopId = "bad";
    assert(!rtMetrics(f, [index], { licenseConfirmed: true }, now).usable);
  }
});
test("LIVE includes waiting time; expired health snapshot cannot extend freshness", () => {
  assert.equal(
    selectJourney(request, status(), { itineraries: [transit] }, now).result
      .durationSeconds,
    1500,
  );
  assert.equal(
    selectJourney(request, status(), { itineraries: [transit] }, now).result
      .quality,
    "LIVE",
  );
  assert(!transitReady(status(), now + 121000));
  assert.equal(
    selectJourney(request, status(), { itineraries: [transit] }, now + 121000)
      .result.quality,
    "FALLBACK_80",
  );
});
test("walking independent of RT; static or canceled transit never becomes LIVE", () => {
  const s = status();
  s.realtime.usable = false;
  assert.equal(
    selectJourney(
      request,
      s,
      { direct: [walking], itineraries: [transit] },
      now,
    ).result.quality,
    "WALKING",
  );
  for (const bad of [
    { cancelled: true },
    { realTime: false },
    { loopedCalendarSince: "2026-01-01" },
    { tripId: "bgs_t" },
  ]) {
    const t = { ...transit, legs: [{ ...transit.legs[0], ...bad }] };
    assert.equal(
      selectJourney(request, status(), { itineraries: [t] }, now).result
        .durationSeconds,
      4800,
    );
  }
  const yesterday = status();
  yesterday.realtime.usableTrips[0].date = "2026-10-02";
  assert.equal(
    selectJourney(request, yesterday, { itineraries: [transit] }, now).result
      .quality,
    "FALLBACK_80",
  );
});
test("missing coordinates block booking; unavailable provider gives exactly 80 minutes", () => {
  assert.equal(
    selectJourney({ ...request, origin: null }, status(), null, now).result
      .quality,
    "UNRESOLVED",
  );
  assert.equal(
    selectJourney(request, { engine: { healthy: false } }, null, now).result
      .durationSeconds,
    4800,
  );
  assert.equal(
    selectJourney(
      { ...request, mode: "WALK" },
      { engine: { healthy: false } },
      null,
      now,
    ).result.quality,
    "UNRESOLVED",
  );
});
test("GTFS structural foreign IDs and expired feed are rejected before import", async () => {
  const build = (stop = "s", end = "20261231") => {
    const z = new AdmZip();
    for (const [n, data] of Object.entries({
      "agency.txt": "agency_id,agency_name\na,A\n",
      "stops.txt": "stop_id,stop_name,stop_lat,stop_lon\ns,S,44.81,20.46\n",
      "routes.txt": "route_id\nr\n",
      "trips.txt": "route_id,service_id,trip_id\nr,c,t\n",
      "stop_times.txt": `trip_id,arrival_time,departure_time,stop_id,stop_sequence\nt,08:00:00,08:00:00,${stop},1\n`,
      "calendar.txt": `service_id,start_date,end_date\nc,20260101,${end}\n`,
    }))
      z.addFile(n, Buffer.from(data));
    return z.toBuffer();
  };
  const source = { id: "bgu", publishedAt: "2026-10-01" };
  assert.equal(
    (await validateGtfs(build(), source, new Date(now))).metadata.trips,
    1,
  );
  await assert.rejects(
    validateGtfs(build("unknown"), source, new Date(now)),
    /FOREIGN_ID/,
  );
  await assert.rejects(
    validateGtfs(build("s", "20260101"), source, new Date(now)),
    /EXPIRED/,
  );
});
test("HTTP allowlist, auth, geocode, reverse, safe fallback and repeated-route cache", async () => {
  let calls = 0;
  const http = async (url) => {
    const u = new URL(url);
    if (u.pathname === "/internal/datasets")
      return Response.json({
        ...status(),
        realtime: { ...realtime(), usable: false },
      });
    calls++;
    if (
      u.pathname === "/api/v1/geocode" ||
      u.pathname === "/api/v1/reverse-geocode"
    )
      return Response.json([
        { id: "node/1", name: "Terazije", lat: 44.81, lon: 20.46 },
      ]);
    return Response.json({});
  };
  const token = "a".repeat(64),
    server = createGateway({
      token,
      motisUrl: "http://localhost:8091",
      http,
      clock: () => now,
    });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const base = "http://127.0.0.1:" + server.address().port,
    headers = {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
    };
  try {
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal((await fetch(base + "/route")).status, 401);
    assert.equal((await fetch(base + "/api/v6/plan", { headers })).status, 404);
    assert.equal(
      (await (await fetch(base + "/geocode?q=Terazije", { headers })).json())
        .results.length,
      1,
    );
    assert.equal(
      (
        await fetch(base + "/reverse-geocode?latitude=44.81&longitude=20.46", {
          headers,
        })
      ).status,
      200,
    );
    const post = () =>
      fetch(base + "/route", {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });
    assert.equal((await (await post()).json()).quality, "FALLBACK_80");
    const count = calls;
    await post();
    assert.equal(calls, count);
    assert.equal(
      (
        await fetch(base + "/matrix", {
          method: "POST",
          headers,
          body: JSON.stringify({
            origins: Array(11).fill(point),
            destinations: Array(10).fill(point),
            mode: "TRANSIT",
            at,
          }),
        })
      ).status,
      400,
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
});

test("expired static calendar blocks LIVE for the requested date", () => {
  const s = status();
  s.static.datasets = [{ valid: true, validUntil: "2026-10-02" }];
  const result = selectJourney(
    request,
    s,
    { itineraries: [transit] },
    now,
  ).result;
  assert.equal(result.quality, "FALLBACK_80");
  s.static.datasets[0].validUntil = "2026-12-31";
  assert.equal(
    selectJourney(request, s, { itineraries: [transit] }, now).result.quality,
    "LIVE",
  );
  assert.equal(
    selectJourney(
      { ...request, at: "2027-01-01T08:00:00Z" },
      s,
      { itineraries: [transit] },
      now,
    ).result.quality,
    "FALLBACK_80",
  );
});
