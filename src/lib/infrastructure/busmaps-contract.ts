import { z } from "zod";
import type { RouteRequest, RouteStep } from "@/lib/domain/routing";
const instant=z.iso.datetime({offset:true});
const stop=z.object({time:instant,rtDeparture:instant.optional(),rtArrival:instant.optional(),place:z.object({name:z.string().max(300).optional()}).optional()});
const section=z.object({id:z.string().max(100).optional(),type:z.enum(["pedestrian","transit"]),travelSummary:z.object({duration:z.number().finite().min(0).max(86400),length:z.number().finite().min(0).max(500000).optional()}),departure:stop,arrival:stop,transport:z.object({mode:z.string().max(30).optional(),name:z.string().max(200).optional(),shortName:z.string().max(100).optional()}).optional(),cancelled:z.boolean().optional()});
const route=z.object({duration:z.number().finite().positive().max(86400),walkingDuration:z.number().finite().min(0).max(86400),transfers:z.number().int().min(0).max(12),sections:z.array(section).min(1).max(32)});
const response=z.object({routes:z.array(route).max(24),alerts:z.array(z.object({effect:z.string().optional(),sectionIds:z.string().optional()})).max(100).optional()});
export type TransitObservation={status:"LIVE"|"SCHEDULE_ONLY"|"UNAVAILABLE";reason:string|null;durationSeconds:number|null;walkingSeconds:number|null;transfers:number|null;steps:RouteStep[];receivedAt:string;expiresAt:string};
export function unavailableTransit(reason:string,now=new Date()):TransitObservation{return {status:"UNAVAILABLE",reason,durationSeconds:null,walkingSeconds:null,transfers:null,steps:[],receivedAt:now.toISOString(),expiresAt:new Date(now.getTime()+30000).toISOString()};}
/** Official v1/routes contract, checked 2026-10-03. Route duration alone never proves realtime. */
export function parseBusMaps(value:unknown,request:RouteRequest,now=new Date()):TransitObservation {
  const data=response.parse(value),options:TransitObservation[]=[];
  for(const r of data.routes){
    const transit=r.sections.filter(s=>s.type==="transit");
    if(!transit.length||r.sections.some(s=>s.cancelled))continue;
    if(data.alerts?.some(a=>["NO_SERVICE","STOP_MOVED","DETOUR"].includes(a.effect??"")&&(!a.sectionIds||r.sections.some(s=>a.sectionIds!.split(/[,\s]+/).includes(s.id??"")))))continue;
    const live=transit.every(s=>s.departure.rtDeparture&&s.arrival.rtArrival);
    const times=r.sections.map(s=>({start:Date.parse(live&&s.type==="transit"?s.departure.rtDeparture!:s.departure.time),end:Date.parse(live&&s.type==="transit"?s.arrival.rtArrival!:s.arrival.time)}));
    // Walking durations are valid for either timeline; propagate actual transit delays through walking legs.
    for(let i=0;i<times.length;i++)if(r.sections[i].type==="pedestrian"){
      if(i>0){times[i].start=times[i-1].end;times[i].end=times[i].start+r.sections[i].travelSummary.duration*1000;}
      else if(times.length>1){times[i].end=times[1].start;times[i].start=times[i].end-r.sections[i].travelSummary.duration*1000;}
    }
    if(times.some((t,i)=>t.end<t.start||(i>0&&t.start<times[i-1].end)))continue;
    const requested=Date.parse(request.at),first=times[0].start,last=times.at(-1)!.end;
    if(request.timing==="arrival"?last>requested+60000:first<requested-60000)continue;
    const seconds=Math.ceil((request.timing==="arrival"?requested-first:last-requested)/1000);
    if(seconds<=0||seconds>86400||r.walkingDuration>seconds)continue;
    options.push({status:live?"LIVE":"SCHEDULE_ONLY",reason:live?null:"SCHEDULE_ONLY",durationSeconds:seconds,walkingSeconds:r.walkingDuration,transfers:r.transfers,steps:r.sections.map((s,i)=>({mode:s.type==="pedestrian"?"WALK":s.transport?.mode??"TRANSIT",durationSeconds:Math.ceil((times[i].end-times[i].start)/1000),line:s.transport?.shortName??s.transport?.name,from:s.departure.place?.name,to:s.arrival.place?.name,departure:new Date(times[i].start).toISOString(),arrival:new Date(times[i].end).toISOString()})),receivedAt:now.toISOString(),expiresAt:new Date(now.getTime()+120000).toISOString()});
  }
  return options.filter(o=>o.status==="LIVE").sort((a,b)=>a.durationSeconds!-b.durationSeconds!)[0]??options.sort((a,b)=>a.durationSeconds!-b.durationSeconds!)[0]??unavailableTransit("NO_RELIABLE_TRANSIT",now);
}
