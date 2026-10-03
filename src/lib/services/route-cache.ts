import { routingProvider } from "@/lib/infrastructure/routing-provider";
import {
  MotisRoutingProvider,
  conservativeRoute,
} from "@/lib/infrastructure/motis-routing";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  GoogleRoutesProvider,
  routingTelemetry,
} from "@/lib/infrastructure/google-routing";
import {
  ROUTING_CONFIG,
  pointKey,
  routeKey,
  routeSample,
  routeUsable,
  unavailable,
  type RouteRequest,
  type RouteResult,
  type RoutingProvider,
} from "@/lib/domain/routing";
export class RoutingService {
  constructor(
    private db: Prisma.TransactionClient,
    private provider: RoutingProvider = routingProvider(),
  ) {}
  async getTravelTime(request: RouteRequest) {
    return (await this.prepare([request])).get(routeKey(request))!;
  }
  async getRouteDetails(request: RouteRequest) {
    return this.provider.getRouteDetails(request);
  }
  async prepare(requests: RouteRequest[], cacheOnly = false) {
    const unique = [...new Map(requests.map((r) => [routeKey(r), r])).values()];
    const table = new Map<string, RouteResult>(),
      now = new Date(),
      deadline = Date.now() + ROUTING_CONFIG.deadlineMs;
    const context = await this.provider.cacheContext?.();
    const keys = (r: RouteRequest) =>
      context
        ? [
            "WALKING",
            "FALLBACK_80",
            ...(context.liveReady ? ["LIVE"] : []),
          ].map((q) => `${routeKey(r)}|${context.dataVersion}|${q}`)
        : [routeKey(r)];
    const logical = new Map(
      unique.flatMap((r) => keys(r).map((k) => [k, routeKey(r)] as const)),
    );
    for (const r of unique)
      table.set(
        routeKey(r),
        this.provider instanceof MotisRoutingProvider
          ? conservativeRoute(r)
          : unavailable(r),
      );
    const rows = await this.db.routeCalculation.findMany({
      where: { cacheKey: { in: unique.flatMap(keys) } },
      take: 5000,
    });
    const cacheHits = new Set<string>();
    for (const row of rows) {
      let metadata: {
        name?: string;
        quality?: RouteResult["quality"];
        dataVersion?: string;
      } = {};
      try {
        const parsed: unknown = JSON.parse(row.provider);
        if (parsed && typeof parsed === "object") metadata = parsed;
      } catch {
        /* Legacy Google cache. */
      }
      if (
        context &&
        (!metadata.quality ||
          !["LIVE", "WALKING", "FALLBACK_80"].includes(metadata.quality) ||
          metadata.name !== "MOTIS" ||
          metadata.dataVersion !== context.dataVersion ||
          (metadata.quality === "LIVE" && !context.liveReady))
      )
        continue;
      const key = logical.get(row.cacheKey);
      if (!key) continue;
      const previous = table.get(key);
      if (previous && routeUsable(previous) && row.expiresAt <= now) continue;
      if (row.expiresAt > now) cacheHits.add(key);
      table.set(key, {
        status: row.expiresAt > now ? "VERIFIED" : "STALE",
        durationSeconds: row.durationSeconds,
        distanceMeters: row.distanceMeters,
        source: metadata.name === "MOTIS" ? "MOTIS" : "Google",
        quality: metadata.quality,
        dataVersion: metadata.dataVersion,
        sampledAt: row.departureAt!.toISOString(),
        calculatedAt: row.calculatedAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
      });
    }
    routingTelemetry(
      "cache_hits",
      rows.filter((r) => r.expiresAt > now).length,
    );
    if (cacheOnly) return table;
    const missing = unique.filter(
      (r) =>
        r.origin &&
        r.destination &&
        (!routeUsable(table.get(routeKey(r))) ||
          (this.provider instanceof MotisRoutingProvider &&
            !cacheHits.has(routeKey(r)))),
    );
    if (
      !process.env.GOOGLE_MAPS_SERVER_API_KEY &&
      this.provider instanceof GoogleRoutesProvider
    )
      return table;
    // One origin and only requested destinations avoids a wasteful Cartesian product.
    const groups = new Map<string, RouteRequest[]>();
    for (const r of missing) {
      const key = [
        pointKey(r.origin),
        r.mode,
        r.timing ?? "departure",
        context ? r.at : routeSample(r),
      ].join("|");
      groups.set(key, [...(groups.get(key) ?? []), r]);
    }
    let elements = 0,
      calls = 0;
    for (const group of groups.values()) {
      for (
        let offset = 0;
        offset < group.length;
        offset += ROUTING_CONFIG.matrixLimit
      ) {
        const batch = group.slice(offset, offset + ROUTING_CONFIG.matrixLimit);
        if (
          calls >= ROUTING_CONFIG.maxRequests ||
          elements + batch.length > ROUTING_CONFIG.maxElements ||
          Date.now() > deadline
        ) {
          routingTelemetry("budget_exhausted");
          return table;
        }
        calls++;
        elements += batch.length;
        const first = batch[0];
        const values = await this.provider.getRouteMatrix(
          [first.origin!],
          batch.map((r) => r.destination!),
          first.mode,
          first.at,
          first.timing,
        );
        const persisted = [];
        for (let i = 0; i < batch.length; i++) {
          const r = batch[i],
            value = values[0]?.[i] ?? unavailable(r, "PROVIDER_ERROR");
          table.set(routeKey(r), value);
          if (!routeUsable(value)) continue;
          persisted.push({
            id: randomUUID(),
            cacheKey: context
              ? `${routeKey(r)}|${context.dataVersion}|${value.quality}`
              : routeKey(r),
            origin: pointKey(r.origin),
            destination: pointKey(r.destination),
            originLatitude: r.origin!.latitude,
            originLongitude: r.origin!.longitude,
            destinationLatitude: r.destination!.latitude,
            destinationLongitude: r.destination!.longitude,
            travelMode: r.mode === "DRIVE" ? "TAXI" : "PUBLIC_TRANSIT",
            departureAt: value.sampledAt,
            durationSeconds: value.durationSeconds!,
            distanceMeters: value.distanceMeters ?? 0,
            provider: context
              ? JSON.stringify({
                  name: value.source,
                  quality: value.quality,
                  dataVersion: context.dataVersion,
                })
              : "Google Routes v2",
            calculatedAt: value.calculatedAt,
            expiresAt: value.expiresAt,
          });
        }
        if (persisted.length)
          await this.db.$executeRaw`
          INSERT INTO "RouteCalculation" ("id","cacheKey","origin","destination","originLatitude","originLongitude","destinationLatitude","destinationLongitude","travelMode","departureAt","durationSeconds","distanceMeters","provider","calculatedAt","expiresAt")
          SELECT x."id",x."cacheKey",x."origin",x."destination",x."originLatitude",x."originLongitude",x."destinationLatitude",x."destinationLongitude",x."travelMode"::"TravelMode",x."departureAt",x."durationSeconds",x."distanceMeters",x."provider",x."calculatedAt",x."expiresAt"
          FROM jsonb_to_recordset(${JSON.stringify(persisted)}::jsonb) AS x("id" text,"cacheKey" text,"origin" text,"destination" text,"originLatitude" numeric,"originLongitude" numeric,"destinationLatitude" numeric,"destinationLongitude" numeric,"travelMode" text,"departureAt" timestamptz,"durationSeconds" integer,"distanceMeters" integer,"provider" text,"calculatedAt" timestamptz,"expiresAt" timestamptz)
          ON CONFLICT ("cacheKey") DO UPDATE SET "durationSeconds"=EXCLUDED."durationSeconds", "distanceMeters"=EXCLUDED."distanceMeters", "calculatedAt"=EXCLUDED."calculatedAt", "expiresAt"=EXCLUDED."expiresAt", "provider"=EXCLUDED."provider", "departureAt"=EXCLUDED."departureAt"`;
      }
    }
    return table;
  }
}
