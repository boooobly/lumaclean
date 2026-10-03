import {randomUUID} from "node:crypto";
import type {PrismaClient} from "@/generated/prisma/client";
import {getDatabase} from "@/lib/database/client";
import {pointKey,type RouteRequest} from "@/lib/domain/routing";
import type {TransitObservation} from "@/lib/infrastructure/busmaps-contract";
import {busMapsMonthlyLimit,busMapsPeriod,type BusMapsStore,type UsageCounter} from "@/lib/infrastructure/busmaps-transit";
import {busMapsAccess} from "@/lib/infrastructure/busmaps-status";
export class PrismaBusMapsStore implements BusMapsStore {
  // Always a root client: an aborted booking must not refund an external HTTP request.
  constructor(private db:PrismaClient=getDatabase()){}
  async cached(key:string,now:Date){
    const rows=await this.db.routeCalculation.findMany({where:{cacheKey:{in:[key+"|LIVE_EXTERNAL",key+"|FALLBACK_80"]},expiresAt:{gt:now}},orderBy:{calculatedAt:"desc"},take:1});
    if(!rows.length)return null;
    try{const value=JSON.parse(rows[0].provider);return value.name==="BusMaps"&&value.snapshot?.receivedAt&&Date.parse(value.snapshot.expiresAt)>now.getTime()?value.snapshot as TransitObservation:null;}catch{return null;}
  }
  async save(key:string,r:RouteRequest,value:TransitObservation){
    if(!r.origin||!r.destination)return;
    const quality=value.status==="LIVE"?"LIVE_EXTERNAL":"FALLBACK_80";
    const data={origin:pointKey(r.origin),destination:pointKey(r.destination),originLatitude:r.origin.latitude,originLongitude:r.origin.longitude,destinationLatitude:r.destination.latitude,destinationLongitude:r.destination.longitude,travelMode:"PUBLIC_TRANSIT" as const,departureAt:new Date(r.at),durationSeconds:value.durationSeconds??0,distanceMeters:0,provider:JSON.stringify({name:"BusMaps",quality,snapshot:value}),calculatedAt:new Date(value.receivedAt),expiresAt:new Date(value.expiresAt)};
    await this.db.$transaction([
      this.db.routeCalculation.upsert({where:{cacheKey:key+"|"+quality},create:{...data,id:randomUUID(),cacheKey:key+"|"+quality},update:data}),
      // A newer failed check must not uncover an older LIVE entry when the negative cache expires.
      this.db.routeCalculation.deleteMany({where:{cacheKey:key+"|"+(quality==="LIVE_EXTERNAL"?"FALLBACK_80":"LIVE_EXTERNAL")}}),
    ]);
  }
  async reserve(period:string,limit:number){
    if(limit<=0)return false;
    const rows=await this.db.$queryRaw<{period:string}[]>`INSERT INTO "RoutingUsageMonth" ("period","requests") VALUES (${period},1) ON CONFLICT ("period") DO UPDATE SET "requests"="RoutingUsageMonth"."requests"+1 WHERE "RoutingUsageMonth"."requests"<${limit} RETURNING "period"`;
    return rows.length===1;
  }
  async count(period:string,counter:UsageCounter){await this.db.routingUsageMonth.upsert({where:{period},create:{period,[counter]:1},update:{[counter]:{increment:1}}});}
  async acquire(key:string,owner:string){const rows=await this.db.$queryRaw<{key:string}[]>`INSERT INTO "RoutingRequestLease" ("key","owner","expiresAt") VALUES (${key},${owner},clock_timestamp()+interval '12 seconds') ON CONFLICT ("key") DO UPDATE SET "owner"=EXCLUDED."owner","expiresAt"=EXCLUDED."expiresAt" WHERE "RoutingRequestLease"."expiresAt"<clock_timestamp() RETURNING "key"`;return rows.length===1;}
  async release(key:string,owner:string){await this.db.routingRequestLease.deleteMany({where:{key,owner}});}
}
export async function busMapsUsage(db:PrismaClient=getDatabase()){
  const period=busMapsPeriod(),limit=busMapsMonthlyLimit(),row=await db.routingUsageMonth.findUnique({where:{period}}),requests=row?.requests??0;
  const access=busMapsAccess(),configured=access==="ACTIVE";
  return {period,limit,requests,remaining:Math.max(0,limit-requests),configured,status:configured&&requests>=limit?"QUOTA_REACHED":access,cacheHits:row?.cacheHits??0,errors:row?.errors??0,liveLegs:row?.liveLegs??0,fallbackLegs:row?.fallbackLegs??0};
}
