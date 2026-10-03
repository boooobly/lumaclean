import { createHash } from "node:crypto";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import { parse as streamParse } from "csv-parse";
import { Readable } from "node:stream";
import Gtfs from "gtfs-realtime-bindings";
export const SOURCES = [
  {
    id: "bgu",
    name: "Belgrade city",
    url: "https://data.gov.rs/sr/datasets/r/729be9a1-7ed9-453d-9a3d-68fa30f07529",
    publishedAt: "2025-10-31T11:19:18Z",
  },
  {
    id: "bgs",
    name: "Belgrade suburban",
    url: "https://data.gov.rs/sr/datasets/r/60f82229-16c7-4939-961b-2c24873d3e06",
    publishedAt: "2025-07-01T15:54:03Z",
  },
];
export const RT_URL = "https://rt.buslogic.baguette.pirnet.si/beograd/rt.pb";
export const OSM_URL =
  "https://download.geofabrik.de/europe/serbia-latest.osm.pbf";
export const digest = (b) => createHash("sha256").update(b).digest("hex");
const isoDate = (s) =>
  /^\d{8}$/.test(s ?? "")
    ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
    : null;
// Only repair CSV quoting. Never extend calendar, remap IDs or invent departures.
export async function validateGtfs(buffer, source, now = new Date()) {
  const zip = new AdmZip(buffer),
    entries = zip.getEntries();
  if (
    entries.some(
      (e) => e.entryName.includes("..") || e.header.size > 400 * 1024 * 1024,
    ) ||
    entries.reduce((n, e) => n + e.header.size, 0) > 800 * 1024 * 1024
  )
    throw Error("INVALID_ARCHIVE");
  const tables = new Map(),
    normalized = new AdmZip();
  let quotingRepairs = 0;
  for (const e of entries.filter((e) => e.entryName.endsWith(".txt"))) {
    const name = e.entryName.split("/").at(-1);
    if (tables.has(name)) throw Error("DUPLICATE_TABLE");
    if (name === "stop_times.txt") {
      tables.set(name, []);
      continue;
    }
    const raw = e.getData();
    let rows,
      repaired = false;
    try {
      rows = parse(raw, { columns: true, bom: true, skip_empty_lines: true });
    } catch {
      rows = parse(raw, {
        columns: true,
        bom: true,
        skip_empty_lines: true,
        relax_quotes: true,
      });
      quotingRepairs++;
      repaired = true;
    }
    tables.set(name, rows);
    const columns = Object.keys(rows[0] ?? {}),
      esc = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
    normalized.addFile(
      name,
      repaired
        ? Buffer.from(
            [
              columns.map(esc).join(","),
              ...rows.map((r) => columns.map((c) => esc(r[c])).join(",")),
            ].join("\n") + "\n",
          )
        : raw,
    );
  }
  for (const n of ["agency.txt", "stops.txt", "routes.txt", "trips.txt"])
    if (!tables.get(n)?.length) throw Error("REQUIRED_TABLE_MISSING");
  if (!tables.has("stop_times.txt")) throw Error("REQUIRED_TABLE_MISSING");
  const stops = new Set(tables.get("stops.txt").map((x) => x.stop_id)),
    routes = new Set(tables.get("routes.txt").map((x) => x.route_id)),
    trips = new Map(
      tables.get("trips.txt").map((x) => [x.trip_id, x.route_id]),
    );
  if (
    stops.size !== tables.get("stops.txt").length ||
    routes.size !== tables.get("routes.txt").length ||
    trips.size !== tables.get("trips.txt").length
  )
    throw Error("DUPLICATE_IDS");
  if (tables.get("trips.txt").some((x) => !routes.has(x.route_id)))
    throw Error("FOREIGN_ID_MISMATCH");
  const stopTimesEntry = entries.find(
      (e) => e.entryName.split("/").at(-1) === "stop_times.txt",
    ),
    rawTimes = stopTimesEntry.getData();
  let stopTimes = 0;
  const chunks = function* () {
    for (let i = 0; i < rawTimes.length; i += 65536)
      yield rawTimes.subarray(i, i + 65536);
  };
  for await (const x of Readable.from(chunks()).pipe(
    streamParse({ columns: true, bom: true, skip_empty_lines: true }),
  )) {
    stopTimes++;
    if (!trips.has(x.trip_id) || !stops.has(x.stop_id))
      throw Error("FOREIGN_ID_MISMATCH");
  }
  if (!stopTimes) throw Error("REQUIRED_TABLE_MISSING");
  normalized.addFile("stop_times.txt", rawTimes);
  if (
    tables
      .get("stops.txt")
      .some(
        (x) =>
          !Number.isFinite(+x.stop_lat) ||
          !Number.isFinite(+x.stop_lon) ||
          Math.abs(+x.stop_lat) > 90 ||
          Math.abs(+x.stop_lon) > 180,
      )
  )
    throw Error("INVALID_COORDINATES");
  const info = tables.get("feed_info.txt")?.[0] ?? {},
    calendar = tables.get("calendar.txt") ?? [],
    exceptions = tables.get("calendar_dates.txt") ?? [];
  const today = now.toISOString().slice(0, 10),
    ends = [
      ...calendar.map((x) => isoDate(x.end_date)),
      ...exceptions
        .filter((x) => x.exception_type === "1")
        .map((x) => isoDate(x.date)),
    ]
      .filter(Boolean)
      .sort();
  const end = [isoDate(info.feed_end_date), ends.at(-1)]
    .filter(Boolean)
    .sort()[0];
  if (!end || end < today) throw Error("EXPIRED_TIMETABLE");
  const serviceIds = new Set([
    ...calendar.map((x) => x.service_id),
    ...exceptions.map((x) => x.service_id),
  ]);
  if (tables.get("trips.txt").some((x) => !serviceIds.has(x.service_id)))
    throw Error("SERVICE_ID_MISMATCH");
  return {
    bytes: normalized.toBuffer(),
    index: { id: source.id, trips, routes, stops },
    metadata: {
      ...source,
      license: "SODL",
      licenseUrl: "https://data.gov.rs/sr/terms/",
      downloadedAt: now.toISOString(),
      version: info.feed_version ?? digest(buffer).slice(0, 16),
      sha256: digest(buffer),
      validUntil: end,
      stops: stops.size,
      routes: routes.size,
      trips: trips.size,
      stopTimes,
      quotingRepairs,
      modifications: "CSV quoting normalized; schedules/IDs/calendar unchanged",
      valid: true,
    },
  };
}
export function rtMetrics(feed, indexes, config = {}, now = Date.now()) {
  const maxAge = Number(config.maxAgeSeconds ?? 120),
    threshold = Number(config.minMatchRatio ?? 0.8),
    licenseConfirmed = config.licenseConfirmed === true;
  const entities = feed.entity ?? [],
    stamp = Number(feed.header?.timestamp ?? 0),
    age = now / 1000 - stamp;
  let tu = 0,
    vp = 0,
    tripCount = 0,
    tripMatched = 0,
    routeCount = 0,
    routeMatched = 0,
    stopCount = 0,
    stopMatched = 0,
    usable = 0;
  const usableTripIds = [],
    usableTrips = [];
  for (const e of entities) {
    if (e.tripUpdate) tu++;
    if (e.vehicle) vp++;
    const update = e.tripUpdate ?? e.vehicle,
      trip = update?.trip;
    if (!trip) continue;
    const matches = indexes.filter((x) => x.trips.has(trip.tripId));
    if (trip.tripId) {
      tripCount++;
      if (matches.length) tripMatched++;
    }
    const route = trip.routeId || matches[0]?.trips.get(trip.tripId),
      routeGood = matches.some(
        (x) => x.routes.has(route) && x.trips.get(trip.tripId) === route,
      );
    if (route) {
      routeCount++;
      if (routeGood) routeMatched++;
    }
    let stopsGood = true;
    for (const s of e.tripUpdate?.stopTimeUpdate ?? []) {
      if (!s.stopId) {
        stopsGood = false;
        continue;
      }
      stopCount++;
      if (matches.some((x) => x.stops.has(s.stopId))) stopMatched++;
      else stopsGood = false;
    }
    const updateAge = now / 1000 - Number(update.timestamp ?? stamp),
      timed = e.tripUpdate?.stopTimeUpdate?.some(
        (s) =>
          s.arrival?.time ||
          s.departure?.time ||
          s.arrival?.delay !== undefined ||
          s.departure?.delay !== undefined,
      );
    const compatible = matches.filter(
      (x) =>
        x.trips.get(trip.tripId) === route &&
        (e.tripUpdate?.stopTimeUpdate ?? []).every(
          (s) => s.stopId && x.stops.has(s.stopId),
        ),
    );
    if (
      e.tripUpdate &&
      compatible.length &&
      routeGood &&
      stopsGood &&
      timed &&
      updateAge >= -60 &&
      updateAge <= maxAge &&
      ![1, 3, 5, 6].includes(trip.scheduleRelationship)
    ) {
      usable++;
      for (const x of compatible) {
        const id = x.id ? x.id + "_" + trip.tripId : trip.tripId;
        usableTripIds.push(id);
        usableTrips.push({
          id,
          date: trip.startDate
            ? isoDate(trip.startDate)
            : new Intl.DateTimeFormat("en-CA", {
                timeZone: "Europe/Belgrade",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
              }).format(new Date(stamp * 1000)),
        });
      }
    }
  }
  const ratio = (a, b) => (b ? a / b : 0),
    tripRatio = ratio(tripMatched, tripCount),
    routeRatio = ratio(routeMatched, routeCount),
    stopRatio = ratio(stopMatched, stopCount),
    usableRatio = ratio(usable, tu);
  const fresh = stamp > 0 && age >= -60 && age <= maxAge;
  return {
    status: fresh ? "FRESH" : "STALE",
    timestamp: stamp,
    freshnessSeconds: Math.max(0, age),
    entitiesReceived: entities.length,
    tripUpdates: tu,
    vehiclePositions: vp,
    tripIdsMatched: tripMatched,
    routeIdsMatched: routeMatched,
    stopIdsMatched: stopMatched,
    tripMatchRatio: tripRatio,
    routeMatchRatio: routeRatio,
    stopMatchRatio: stopRatio,
    percentageUsable: usableRatio * 100,
    usableTripIds,
    usableTrips,
    licenseConfirmed,
    usable:
      fresh &&
      licenseConfirmed &&
      tu > 0 &&
      tripRatio >= threshold &&
      routeRatio >= threshold &&
      stopRatio >= threshold &&
      usableRatio >= threshold,
  };
}
export async function fetchBounded(
  url,
  limit = 32 * 1024 * 1024,
  timeout = 30000,
) {
  const r = await fetch(url, {
    headers: { "User-Agent": "LumaCleanRouting/1.0 (https://lumacleanrs.com)" },
    signal: AbortSignal.timeout(timeout),
  });
  if (!r.ok) throw Error("SOURCE_HTTP_" + r.status);
  if (Number(r.headers.get("content-length")) > limit)
    throw Error("SOURCE_TOO_LARGE");
  let size = 0;
  const chunks = [];
  for await (const c of r.body) {
    size += c.length;
    if (size > limit) {
      await r.body.cancel().catch(() => {});
      throw Error("SOURCE_TOO_LARGE");
    }
    chunks.push(c);
  }
  return {
    bytes: Buffer.concat(chunks),
    modified: r.headers.get("last-modified"),
    url: r.url,
  };
}
export const decodeRt = (b) => Gtfs.transit_realtime.FeedMessage.decode(b);
