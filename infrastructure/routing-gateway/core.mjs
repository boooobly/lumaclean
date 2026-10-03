import { createHash, timingSafeEqual } from "node:crypto";
import { z } from "zod";
export const pointSchema = z
  .object({
    latitude: z.number().min(44.2).max(45.2),
    longitude: z.number().min(19.9).max(21),
    placeId: z.string().max(300).nullish(),
  })
  .strict();
export const routeSchema = z
  .object({
    origin: pointSchema.nullish(),
    destination: pointSchema.nullish(),
    mode: z.enum(["TRANSIT", "WALK", "DRIVE"]),
    at: z.iso.datetime({ offset: true }),
    timing: z.enum(["arrival", "departure"]).default("departure"),
  })
  .strict();
export const matrixSchema = z
  .object({
    origins: z.array(pointSchema).min(1).max(20),
    destinations: z.array(pointSchema).min(1).max(100),
    mode: z.enum(["TRANSIT", "WALK", "DRIVE"]),
    at: z.iso.datetime({ offset: true }),
    timing: z.enum(["arrival", "departure"]).default("departure"),
  })
  .strict()
  .refine(
    (v) => v.origins.length * v.destinations.length <= 100,
    "MATRIX_TOO_LARGE",
  );
export function authorized(header, token) {
  if (!token || token.length < 32 || !header?.startsWith("Bearer "))
    return false;
  const hash = (x) => createHash("sha256").update(x).digest();
  return timingSafeEqual(hash(header.slice(7)), hash(token));
}
export class Limits {
  constructor({ concurrency = 4, perMinute = 240 } = {}) {
    this.concurrency = concurrency;
    this.perMinute = perMinute;
    this.active = 0;
    this.count = 0;
    this.window = 0;
  }
  enter(now = Date.now()) {
    if (now - this.window >= 60000) {
      this.window = now;
      this.count = 0;
    }
    if (this.active >= this.concurrency || this.count >= this.perMinute)
      return false;
    this.count++;
    this.active++;
    return true;
  }
  leave() {
    this.active--;
  }
}
export function transitReady(s, now = Date.now()) {
  const r = s?.realtime,
    age = r?.timestamp ? now / 1000 - r.timestamp : Infinity;
  return (
    s?.engine?.healthy === true &&
    s?.static?.valid === true &&
    r?.usable === true &&
    r?.licenseConfirmed === true &&
    age >= -60 &&
    age <= Number(s.thresholds?.maxAgeSeconds ?? 120)
  );
}
export function transitReadyFor(s, request, now = Date.now()) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Belgrade",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(request.at));
  return (
    transitReady(s, now) &&
    (s.static.datasets ?? []).every((d) => d.valid && d.validUntil >= day)
  );
}
export function result(
  request,
  quality,
  status,
  dataVersion = "offline",
  durationSeconds = null,
  reason = null,
  now = Date.now(),
) {
  const ttl =
    quality === "LIVE"
      ? 60
      : quality === "WALKING"
        ? 1800
        : quality === "FALLBACK_80"
          ? 300
          : 0;
  return {
    status: quality === "UNRESOLVED" ? "UNVERIFIED" : "VERIFIED",
    quality,
    durationSeconds: quality === "FALLBACK_80" ? 4800 : durationSeconds,
    distanceMeters: null,
    source: "MOTIS",
    dataVersion,
    sampledAt: request.at,
    calculatedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl * 1000).toISOString(),
    reason: reason ?? status,
  };
}
export function selectJourney(request, s, data, now = Date.now()) {
  const version = s?.dataVersion ?? "offline";
  if (!request.origin || !request.destination)
    return {
      result: result(
        request,
        "UNRESOLVED",
        "COORDINATES_REQUIRED",
        version,
        null,
        null,
        now,
      ),
      steps: [],
    };
  const walking = (data?.direct ?? [])
    .filter(
      (i) =>
        i.legs?.length &&
        i.legs.every((l) => l.mode === "WALK") &&
        i.duration > 0 &&
        i.duration <= 7200,
    )
    .sort((a, b) => a.duration - b.duration)[0];
  const live =
    transitReadyFor(s, request, now) &&
    (data?.itineraries ?? [])
      .filter(
        (i) =>
          i.legs?.some((l) => l.mode !== "WALK") &&
          i.legs.every(
            (l) =>
              l.mode === "WALK" ||
              (l.realTime === true &&
                !l.cancelled &&
                !l.loopedCalendarSince &&
                s.realtime.usableTrips?.some(
                  (t) =>
                    t.id === l.tripId &&
                    t.date ===
                      (l.serviceDay ??
                        new Intl.DateTimeFormat("en-CA", {
                          timeZone: "Europe/Belgrade",
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                        }).format(new Date(l.startTime))),
                )),
          ),
      )
      .map((i) => ({
        ...i,
        effective:
          request.timing === "arrival"
            ? (Date.parse(request.at) - Date.parse(i.startTime)) / 1000
            : (Date.parse(i.endTime) - Date.parse(request.at)) / 1000,
      }))
      .filter(
        (i) =>
          Number.isFinite(i.effective) &&
          i.effective > 0 &&
          i.effective <= 21600,
      )
      .sort((a, b) => a.effective - b.effective)[0];
  let selected = null,
    quality = "FALLBACK_80",
    seconds = 4800;
  if (request.mode === "WALK") {
    if (walking && s?.engine?.healthy) {
      selected = walking;
      quality = "WALKING";
      seconds = walking.duration;
    } else
      return {
        result: result(
          request,
          "UNRESOLVED",
          "WALKING_UNAVAILABLE",
          version,
          null,
          null,
          now,
        ),
        steps: [],
      };
  } else if (request.mode === "TRANSIT") {
    if (live && (!walking || live.effective < walking.duration)) {
      selected = live;
      quality = "LIVE";
      seconds = live.effective;
    } else if (walking && s?.engine?.healthy && walking.duration <= 4800) {
      selected = walking;
      quality = "WALKING";
      seconds = walking.duration;
    }
  }
  const value = result(
    request,
    quality,
    transitReady(s, now)
      ? "ROUTE_NOT_VERIFIABLE"
      : s?.engine?.healthy
        ? "REALTIME_NOT_VERIFIABLE"
        : "MOTIS_UNAVAILABLE",
    version,
    Math.ceil(seconds),
    null,
    now,
  );
  value.distanceMeters = selected
    ? Math.round(selected.legs.reduce((n, l) => n + (l.distance ?? 0), 0))
    : null;
  return {
    result: value,
    steps: (selected?.legs ?? []).map((l) => ({
      mode: l.mode,
      durationSeconds: l.duration,
      line: l.routeShortName,
      from: l.from?.name,
      to: l.to?.name,
      departure: l.startTime,
      arrival: l.endTime,
    })),
    geometries: (selected?.legs ?? [])
      .map((l) => l.legGeometry)
      .filter((g) => g?.points)
      .map((g) => ({ points: g.points, precision: g.precision ?? 6 })),
    polylines: (selected?.legs ?? [])
      .map((l) => l.legGeometry?.points)
      .filter(Boolean),
  };
}
