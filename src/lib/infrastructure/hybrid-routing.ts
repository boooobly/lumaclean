import type {GeoPoint,RouteMode,RouteRequest,RouteResult,RoutingProvider,RouteDetails} from "@/lib/domain/routing";
import {fallbackTravelMinutes} from "@/lib/domain/routing-policy";
import {conservativeRoute} from "./motis-routing";
import {BusMapsTransitProvider} from "./busmaps-transit";
export class HybridRoutingProvider implements RoutingProvider {
  constructor(private motis:RoutingProvider,private external:BusMapsTransitProvider,private fallbackMinutes=fallbackTravelMinutes()){}
  conservative(r:RouteRequest){const value=conservativeRoute(r);return value.quality==="FALLBACK_80"?{...value,durationSeconds:this.fallbackMinutes*60}:value;}
  private normalize(value:RouteResult){return value.quality==="FALLBACK_80"?{...value,durationSeconds:this.fallbackMinutes*60}:value;}
  async cacheContext(){const c=await this.motis.cacheContext?.()??{dataVersion:"offline",liveReady:false};return {...c,dataVersion:c.dataVersion+":hybrid:"+this.fallbackMinutes+":"+this.external.cacheIdentity,externalReady:this.external.configured};}
  async searchAddress(q:string){return await this.motis.searchAddress?.(q)??[];}
  async reverseGeocode(p:GeoPoint){return await this.motis.reverseGeocode?.(p)??[];}
  async getRouteMatrix(a:GeoPoint[],b:GeoPoint[],m:RouteMode,at:string,t?:"departure"|"arrival"){return (await this.motis.getRouteMatrix(a,b,m,at,t)).map(row=>row.map(v=>this.normalize(v)));}
  async getCandidateMatrix(a:GeoPoint[],b:GeoPoint[],m:RouteMode,at:string,t?:"departure"|"arrival"){return (await (this.motis.getCandidateMatrix?.(a,b,m,at,t)??this.motis.getRouteMatrix(a,b,m,at,t))).map(row=>row.map(v=>this.normalize(v)));}
  async getTravelTime(r:RouteRequest){return this.verifyCritical(r);}
  async verifyCritical(r:RouteRequest,options:{forceFresh?:boolean;base?:RouteResult}={}){
    if(conservativeRoute({...r,mode:"TRANSIT"}).quality==="UNRESOLVED")return this.conservative(r);
    const base=this.normalize(!options.forceFresh&&options.base?.quality!=="STATIC_CANDIDATE"&&options.base?options.base:await this.motis.getTravelTime(r));
    if(base.quality==="UNRESOLVED"||r.mode!=="TRANSIT"||base.quality==="WALKING"||base.quality==="LIVE")return base;
    const value=await this.external.verify(r,options.forceFresh);
    if(value.status!=="LIVE")return {...this.conservative(r),reason:value.reason};
    return {...base,status:"VERIFIED" as const,quality:"LIVE_EXTERNAL" as const,source:"BusMaps" as const,durationSeconds:value.durationSeconds,calculatedAt:value.receivedAt,expiresAt:value.expiresAt,sampledAt:r.at,reason:null};
  }
  async getRouteDetails(r:RouteRequest):Promise<RouteDetails>{
    const base=await this.motis.getRouteDetails(r);
    if(r.mode!=="TRANSIT"||["WALKING","LIVE","UNRESOLVED"].includes(base.result.quality??""))return {...base,result:this.normalize(base.result)};
    const external=await this.external.verify(r);
    if(external.status!=="LIVE")return {result:{...this.conservative(r),reason:external.reason},steps:[]};
    return {result:{...base.result,status:"VERIFIED",source:"BusMaps",quality:"LIVE_EXTERNAL",durationSeconds:external.durationSeconds,calculatedAt:external.receivedAt,expiresAt:external.expiresAt,sampledAt:r.at},steps:external.steps};
  }
}
