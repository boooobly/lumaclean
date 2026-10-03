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
    private provider?: RoutingProvider,
  ) {}
  private async selectedProvider() {
    if (!this.provider) {
      const settings = await this.db.businessSettings.findUnique({where:{id:"default"},select:{fallbackTravelMinutes:true}});
      this.provider = routingProvider(settings?.fallbackTravelMinutes);
    }
    return this.provider;
  }
  async getTravelTime(request: RouteRequest) {
    return (await this.prepare([request])).get(routeKey(request))!;
  }
  async getRouteDetails(request: RouteRequest) {
    return (await this.selectedProvider()).getRouteDetails(request);
  }
  /** Only explicit booking/admin legs; never the optimizer's Cartesian matrix. */
  async prepareCritical(requests:RouteRequest[],options:{forceFresh?:boolean;cacheOnly?:boolean;table?:Map<string,RouteResult>}={}) {
    const provider=await this.selectedProvider(), context=await provider.cacheContext?.();
    const table=options.table??await this.prepare(requests,options.cacheOnly);
    if(options.cacheOnly||!provider.verifyCritical)return table;
    const unique=[...new Map(requests.map(r=>[routeKey(r),r])).values()];
    const deadline=Date.now()+ROUTING_CONFIG.deadlineMs;
    for(let offset=0;offset<unique.length;offset+=2) {
      const batch=unique.slice(offset,offset+2);
      await Promise.all(batch.map(async r=>{
        const value=offset>=ROUTING_CONFIG.maxRequests||Date.now()>deadline
          ? provider.conservative?.(r)??unavailable(r)
          : await provider.verifyCritical!(r,{forceFresh:options.forceFresh,base:table.get(routeKey(r))});
        table.set(routeKey(r),value);
        if(!context||!r.origin||!r.destination||!routeUsable(value))return;
        const prefix=`${routeKey(r)}|${context.dataVersion}|`;
        const data={origin:pointKey(r.origin),destination:pointKey(r.destination),originLatitude:r.origin.latitude,originLongitude:r.origin.longitude,destinationLatitude:r.destination.latitude,destinationLongitude:r.destination.longitude,travelMode:r.mode==="DRIVE"?"TAXI" as const:"PUBLIC_TRANSIT" as const,departureAt:new Date(value.sampledAt),durationSeconds:value.durationSeconds!,distanceMeters:value.distanceMeters??0,provider:JSON.stringify({name:value.source,quality:value.quality,dataVersion:context.dataVersion}),calculatedAt:new Date(value.calculatedAt),expiresAt:new Date(value.expiresAt)};
        await this.db.routeCalculation.upsert({where:{cacheKey:prefix+value.quality},create:{...data,id:randomUUID(),cacheKey:prefix+value.quality},update:data});
        if(value.quality==="FALLBACK_80")await this.db.routeCalculation.deleteMany({where:{cacheKey:prefix+"LIVE_EXTERNAL"}});
      }));
    }
    return table;
  }
  async prepare(requests: RouteRequest[], cacheOnly = false) {
    const provider=await this.selectedProvider();
    const unique = [...new Map(requests.map((r) => [routeKey(r), r])).values()];
    const table = new Map<string, RouteResult>(),
      now = new Date(),
      deadline = Date.now() + ROUTING_CONFIG.deadlineMs;
    const context = await provider.cacheContext?.();
    const keys = (r: RouteRequest) =>
      context
        ? [
            "WALKING",
            "FALLBACK_80",
            ...(context.liveReady ? ["LIVE"] : []),
            ...(context.externalReady ? ["LIVE_EXTERNAL"] : []),
          ].map((q) => `${routeKey(r)}|${context.dataVersion}|${q}`)
        : [routeKey(r)];
    const logical = new Map(
      unique.flatMap((r) => keys(r).map((k) => [k, routeKey(r)] as const)),
    );
    for (const r of unique)
      table.set(
        routeKey(r),
        provider.conservative?provider.conservative(r):provider instanceof MotisRoutingProvider
          ? conservativeRoute(r)
          : unavailable(r),
      );
    const rows = await this.db.routeCalculation.findMany({
      where: { cacheKey: { in: unique.flatMap(keys) } },
      take: 5000,
      orderBy:{calculatedAt:"asc"},
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
          !["LIVE", "LIVE_EXTERNAL", "WALKING", "FALLBACK_80"].includes(metadata.quality) ||
          (metadata.quality==="LIVE_EXTERNAL"?metadata.name!=="BusMaps":metadata.name!=="MOTIS") ||
          metadata.dataVersion !== context.dataVersion ||
          (metadata.quality === "LIVE" && !context.liveReady)||
          (metadata.quality === "LIVE_EXTERNAL" && !context.externalReady))
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
        source: metadata.name === "BusMaps"?"BusMaps":metadata.name === "MOTIS" ? "MOTIS" : "Google",
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
          (!!context &&
            !cacheHits.has(routeKey(r)))),
    );
    if (
      !process.env.GOOGLE_MAPS_SERVER_API_KEY &&
      provider instanceof GoogleRoutesProvider
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
        const values = await provider.getRouteMatrix(
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
