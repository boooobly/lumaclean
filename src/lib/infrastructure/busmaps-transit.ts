import {createHash,randomUUID} from "node:crypto";
import {pointKey,type RouteRequest} from "@/lib/domain/routing";
import {parseBusMaps,unavailableTransit,type TransitObservation} from "./busmaps-contract";
export type UsageCounter="cacheHits"|"errors"|"liveLegs"|"fallbackLegs";
export interface BusMapsStore {
  cached(key:string,now:Date):Promise<TransitObservation|null>;
  save(key:string,request:RouteRequest,value:TransitObservation):Promise<void>;
  reserve(period:string,limit:number):Promise<boolean>;
  count(period:string,counter:UsageCounter):Promise<void>;
  acquire(key:string,owner:string):Promise<boolean>;
  release(key:string,owner:string):Promise<void>;
}
export const busMapsMonthlyLimit=()=>{const n=Number(process.env.BUSMAPS_MONTHLY_ROUTE_LIMIT??1000);return Number.isInteger(n)&&n>=0&&n<=1000000?n:1000;};
export function busMapsPeriod(now=new Date()) {return "BUSMAPS:"+new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Belgrade",year:"numeric",month:"2-digit"}).format(now);}
export function busMapsKey(r:RouteRequest,credential=""){
  const bucket=new Date(Math.floor(Date.parse(r.at)/300000)*300000).toISOString();
  return "busmaps:v1:"+createHash("sha256").update(JSON.stringify([pointKey(r.origin),pointKey(r.destination),bucket,r.at,r.timing??"departure",credential])).digest("hex");
}
export class BusMapsTransitProvider {
  private pending=new Map<string,Promise<TransitObservation>>();
  constructor(private store:BusMapsStore,private key=process.env.BUSMAPS_API_KEY,private http:typeof fetch=fetch,private clock=()=>new Date(),private limit=busMapsMonthlyLimit()){}
  get configured(){return !!this.key?.trim();}
  get cacheIdentity(){return createHash("sha256").update(this.key?.trim()??"absent").digest("hex").slice(0,16);}
  async inspect(request:RouteRequest,forceFresh=false):Promise<TransitObservation>{
    const key=busMapsKey(request,this.key?.trim()),previous=this.pending.get(key);if(previous)return previous;
    const work=this.lookup(request,key,forceFresh).finally(()=>this.pending.delete(key));this.pending.set(key,work);return work;
  }
  async verify(request:RouteRequest,forceFresh=false){
    const value=await this.inspect(request,forceFresh);
    await this.store.count(busMapsPeriod(this.clock()),value.status==="LIVE"?"liveLegs":"fallbackLegs").catch(()=>{});
    return value;
  }
  private async lookup(request:RouteRequest,key:string,forceFresh:boolean):Promise<TransitObservation>{
    const now=this.clock(),period=busMapsPeriod(now);
    if(!this.configured)return unavailableTransit("BUSMAPS_NOT_CONFIGURED",now);
    if(!request.origin||!request.destination)return unavailableTransit("COORDINATES_REQUIRED",now);
    const owner=randomUUID();let acquired=false;
    try{
      if(!forceFresh){const cached=await this.store.cached(key,now);if(cached){await this.store.count(period,"cacheHits");return cached;}}
      acquired=await this.store.acquire(key,owner);
      if(!acquired){
        // Another server owns this request; never spend a second quota unit in parallel.
        for(let i=0;i<12;i++){await new Promise(r=>setTimeout(r,250));const cached=await this.store.cached(key,this.clock());if(cached&&(!forceFresh||Date.parse(cached.receivedAt)>=now.getTime())){await this.store.count(period,"cacheHits");return cached;}}
        return unavailableTransit("VERIFICATION_BUSY",this.clock());
      }
      if(!forceFresh){const cached=await this.store.cached(key,this.clock());if(cached){await this.store.count(period,"cacheHits");return cached;}}
      if(!await this.store.reserve(period,this.limit))return unavailableTransit("MONTHLY_LIMIT_REACHED",this.clock());
      const url=new URL("https://capi.busmaps.com:8443/v1/routes");
      url.searchParams.set("origin",pointKey(request.origin));url.searchParams.set("destination",pointKey(request.destination));
      url.searchParams.set(request.timing==="arrival"?"arrivalTime":"departureTime",request.at);
      url.searchParams.set("maxRoutes","1");url.searchParams.set("transfers","3");url.searchParams.set("transport","bus,subway,train,tram");url.searchParams.set("lang","en");
      const response=await this.http(url,{headers:{"capi-key":"Bearer "+this.key!.trim(),"capi-host":"busmaps.com"},signal:AbortSignal.timeout(5000),redirect:"error",cache:"no-store"});
      if(!response.ok)throw Error(response.status===429?"BUSMAPS_QUOTA_RESPONSE":"BUSMAPS_HTTP_FAILURE");
      const reader=response.body?.getReader();let body="",bytes=0;const decoder=new TextDecoder();if(!reader)throw Error("BUSMAPS_INVALID_RESPONSE");
      while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>1024*1024){await reader.cancel();throw Error("BUSMAPS_BOUNDED_RESPONSE");}body+=decoder.decode(part.value,{stream:true});}body+=decoder.decode();
      const value=parseBusMaps(JSON.parse(body),request,this.clock());await this.store.save(key,request,value);return value;
    }catch(error){
      await this.store.count(period,"errors").catch(()=>{});
      const value=unavailableTransit(error instanceof Error&&error.message==="BUSMAPS_QUOTA_RESPONSE"?error.message:"BUSMAPS_UNAVAILABLE",this.clock());
      if(acquired)await this.store.save(key,request,value).catch(()=>{});return value;
    }finally{if(acquired)await this.store.release(key,owner).catch(()=>{});}
  }
}
