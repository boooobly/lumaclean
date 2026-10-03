import {DEFAULT_FALLBACK_TRAVEL_MINUTES} from "@/lib/domain/routing-policy";
import { z } from "zod";
import { createHash } from "node:crypto";
import type {
  AddressMatch,
  GeoPoint,
  RouteDetails,
  RouteMode,
  RouteRequest,
  RouteResult,
  RoutingProvider,
} from "@/lib/domain/routing";

const point = z.object({
  latitude: z.number().min(44.2).max(45.2),
  longitude: z.number().min(19.9).max(21),
});
const match = point.extend({
  id: z.string().max(300),
  displayAddress: z.string().min(1).max(500),
}).transform(value => ({...value,id:value.id.trim()||"motis-address:"+createHash("sha256").update(JSON.stringify([value.displayAddress,value.latitude,value.longitude])).digest("hex")}));
const responseResult = z.object({
  status: z.enum(["VERIFIED", "UNVERIFIED"]),
  quality: z.enum(["LIVE", "WALKING", "FALLBACK_80", "UNRESOLVED"]),
  durationSeconds: z.number().int().min(1).max(21600).nullable(),
  distanceMeters: z.number().int().nonnegative().nullable(),
  source: z.literal("MOTIS"),
  dataVersion: z.string().max(100),
  sampledAt: z.iso.datetime({ offset: true }),
  calculatedAt: z.iso.datetime({ offset: true }),
  expiresAt: z.iso.datetime({ offset: true }),
  reason: z.string().max(100).nullish(),
});
const step = z.object({
  mode: z.string().max(30),
  durationSeconds: z.number().nonnegative(),
  line: z.string().max(100).optional(),
  from: z.string().max(500).optional(),
  to: z.string().max(500).optional(),
  departure: z.string().optional(),
  arrival: z.string().optional(),
});
export type DatasetStatus = {
  engine: { healthy: boolean; version?: string };
  osm?: { version?: string; downloadedAt?: string } | null;
  static: {
    valid: boolean;
    datasets: {
      name: string;
      version: string;
      ageDays: number;
      validUntil: string;
      valid: boolean;
    }[];
  };
  realtime: {
    status: string;
    usable: boolean;
    licenseConfirmed: boolean;
    timestamp?: number;
    freshnessSeconds?: number | null;
    entitiesReceived?: number;
    tripUpdates?: number;
    vehiclePositions?: number;
    tripMatchRatio?: number;
    routeMatchRatio?: number;
    stopMatchRatio?: number;
    percentageUsable?: number;
  };
  dataVersion: string;
  thresholds?: {
    maxAgeSeconds?: number;
    minMatchRatio?: number;
    maxStaticAgeDays?: number;
  };
  routingReadiness?: string;
  update?: { busy: boolean; lastError: string | null };
};
export function conservativeRoute(
  r: RouteRequest,
  now = new Date(),
  dataVersion = "offline",
): RouteResult {
  const valid =
    !!r.origin &&
    !!r.destination &&
    point.safeParse(r.origin).success &&
    point.safeParse(r.destination).success;
  return {
    source: "MOTIS",
    quality: valid && r.mode !== "WALK" ? "FALLBACK_80" : "UNRESOLVED",
    status: valid && r.mode !== "WALK" ? "VERIFIED" : "UNVERIFIED",
    durationSeconds: valid && r.mode !== "WALK" ? DEFAULT_FALLBACK_TRAVEL_MINUTES * 60 : null,
    distanceMeters: null,
    dataVersion,
    sampledAt: r.at,
    calculatedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + (valid ? 300000 : 0)).toISOString(),
    reason: valid ? "MOTIS_UNAVAILABLE" : "COORDINATES_REQUIRED",
  };
}
export class MotisRoutingProvider implements RoutingProvider {
  private snapshot: { value: DatasetStatus; at: number } | null = null;
  private pending: Promise<DatasetStatus> | null = null;
  constructor(
    private url = process.env.LUMACLEAN_ROUTING_URL,
    private token = process.env.LUMACLEAN_ROUTING_TOKEN,
    private http: typeof fetch = fetch,
    private clock = () => new Date(),
  ) {}
  private async call(path: string, body?: unknown) {
    if (!this.url || !this.token || this.token.length < 32)
      throw Error("ROUTING_UNCONFIGURED");
    const url = new URL(this.url);
    if (
      url.protocol !== "https:" &&
      !(
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1"].includes(url.hostname)
      )
    )
      throw Error("ROUTING_HTTPS_REQUIRED");
    const r = await this.http(new URL(path, url), {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: "Bearer " + this.token,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(13000),
      redirect: "error",
      cache: "no-store",
    });
    if (!r.ok) throw Error("ROUTING_UNAVAILABLE");
    const text = await r.text();
    if (text.length > 1024 * 1024) throw Error("BOUNDED_RESPONSE");
    return JSON.parse(text);
  }
  async datasetsStatus(): Promise<DatasetStatus> {
    if (this.snapshot && this.clock().getTime() - this.snapshot.at < 10000)
      return this.snapshot.value;
    this.pending ??= this.call("/datasets/status")
      .then((value) => {
        const parsed = z
          .object({
            engine: z.object({
              healthy: z.boolean(),
              version: z.string().optional(),
            }),
            static: z.object({
              valid: z.boolean(),
              datasets: z.array(z.unknown()),
            }),
            realtime: z
              .object({
                status: z.string(),
                usable: z.boolean(),
                licenseConfirmed: z.boolean(),
                timestamp: z.number().finite().optional(),
              })
              .passthrough(),
            dataVersion: z.string(),
          })
          .passthrough()
          .parse(value);
        const status = parsed as DatasetStatus;
        this.snapshot = { value: status, at: this.clock().getTime() };
        return status;
      })
      .catch(() => {
        const value: DatasetStatus = {
          engine: { healthy: false },
          static: { valid: false, datasets: [] },
          realtime: {
            status: "UNAVAILABLE",
            usable: false,
            licenseConfirmed: false,
          },
          dataVersion: "offline",
        };
        this.snapshot = { value, at: this.clock().getTime() };
        return value;
      })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  }
  async cacheContext() {
    const s = await this.datasetsStatus(),
      age = this.clock().getTime() / 1000 - (s.realtime.timestamp ?? 0);
    return {
      dataVersion: s.dataVersion,
      liveReady:
        s.engine.healthy &&
        s.static.valid &&
        s.realtime.usable &&
        s.realtime.licenseConfirmed &&
        age >= -60 &&
        age <= (s.thresholds?.maxAgeSeconds ?? 120),
    };
  }
  async searchAddress(query: string): Promise<AddressMatch[]> {
    if (query.trim().length < 3 || query.length > 200) return [];
    return z
      .object({ results: z.array(match).max(5) })
      .parse(await this.call("/geocode?q=" + encodeURIComponent(query)))
      .results;
  }
  async reverseGeocode(p: GeoPoint): Promise<AddressMatch[]> {
    point.parse(p);
    return z
      .object({ results: z.array(match).max(3) })
      .parse(
        await this.call(
          `/reverse-geocode?latitude=${p.latitude}&longitude=${p.longitude}`,
        ),
      ).results;
  }
  private async normalize(
    value: unknown,
    r: RouteRequest,
  ): Promise<RouteResult> {
    const parsed = responseResult.parse(value),
      now = this.clock();
    if (
      Date.parse(parsed.expiresAt) <= now.getTime() ||
      Date.parse(parsed.expiresAt) > now.getTime() + 1801000 ||
      (parsed.quality === "UNRESOLVED" &&
        (parsed.status !== "UNVERIFIED" || parsed.durationSeconds !== null)) ||
      (parsed.quality !== "UNRESOLVED" &&
        (parsed.status !== "VERIFIED" || !parsed.durationSeconds)) ||
      (parsed.quality === "FALLBACK_80" && parsed.durationSeconds !== DEFAULT_FALLBACK_TRAVEL_MINUTES * 60)
    )
      throw Error("INVALID_ROUTE_RESULT");
    if (
      parsed.quality === "LIVE" &&
      (!(await this.cacheContext()).liveReady ||
        Date.parse(parsed.expiresAt) > now.getTime() + 61000)
    )
      return conservativeRoute(r, now, parsed.dataVersion);
    return parsed;
  }
  async getTravelTime(r: RouteRequest) {
    if (!r.origin || !r.destination) return conservativeRoute(r, this.clock());
    try {
      return await this.normalize(await this.call("/route", r), r);
    } catch {
      return conservativeRoute(r, this.clock());
    }
  }
  async getRouteDetails(r: RouteRequest): Promise<RouteDetails> {
    if (!r.origin || !r.destination)
      return { result: conservativeRoute(r, this.clock()), steps: [] };
    try {
      const data = z
        .object({
          result: responseResult,
          steps: z.array(step).max(100),
          polylines: z.array(z.string().max(500000)).max(100).optional(),
          geometries: z
            .array(
              z.object({
                points: z.string().max(500000),
                precision: z.number().int().min(5).max(7),
              }),
            )
            .max(100)
            .optional(),
        })
        .parse(await this.call("/route-details", r));
      const result = await this.normalize(data.result, r);
      return result.quality === data.result.quality
        ? { ...data, result }
        : { result, steps: [] };
    } catch {
      return { result: conservativeRoute(r, this.clock()), steps: [] };
    }
  }
  async getRouteMatrix(
    origins: GeoPoint[],
    destinations: GeoPoint[],
    mode: RouteMode,
    at: string,
    timing: "arrival" | "departure" = "departure",
  ): Promise<RouteResult[][]> {
    if (
      !origins.length ||
      !destinations.length ||
      origins.length > 20 ||
      destinations.length > 100 ||
      origins.length * destinations.length > 100
    )
      throw Error("MATRIX_TOO_LARGE");
    const fallback = () =>
      origins.map((origin) =>
        destinations.map((destination) =>
          conservativeRoute(
            { origin, destination, mode, at, timing },
            this.clock(),
          ),
        ),
      );
    try {
      const rows = z.object({ rows: z.array(z.array(responseResult)) }).parse(
        await this.call("/matrix", {
          origins,
          destinations,
          mode,
          at,
          timing,
        }),
      ).rows;
      if (
        rows.length !== origins.length ||
        rows.some((r) => r.length !== destinations.length)
      )
        throw Error("INVALID_MATRIX");
      return await Promise.all(
        rows.map((row, i) =>
          Promise.all(
            row.map((r, j) =>
              this.normalize(r, {
                origin: origins[i],
                destination: destinations[j],
                mode,
                at,
                timing,
              }),
            ),
          ),
        ),
      );
    } catch {
      return fallback();
    }
  }
}
