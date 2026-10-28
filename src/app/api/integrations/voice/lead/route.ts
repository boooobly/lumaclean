import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDatabase } from "@/lib/database/client";
import { normalizedPhone } from "@/lib/domain/crm";
import { writeAudit } from "@/lib/services/audit";
import { enqueueLeadReview } from "@/lib/services/lead-notifications";
import { publishWebsiteLead } from "@/lib/services/website-leads";
import { serviceIds } from "@/lib/pricing";

export const runtime="nodejs";
const inputSchema=z.object({
  conversationId:z.string().min(8).max(120).regex(/^[a-zA-Z0-9_:\-]+$/),
  phone:z.string().trim().min(6).max(40),
  name:z.string().trim().min(2).max(100).nullable().default(null),
  service:z.enum(serviceIds).nullable().default(null),
  area:z.number().finite().min(25).max(180).nullable().default(null),
  notes:z.string().trim().max(900).default(""),
  consentToContact:z.literal(true),
  locale:z.literal("sr").default("sr"),
}).strict().superRefine((v,ctx)=>{if((v.area!==null)!==(v.service!==null))ctx.addIssue({code:"custom",message:"Service and area must be present together"});});

function authorized(request:Request){
 const expected=process.env.LUMACLEAN_VOICE_API_SECRET;
 const supplied=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
 if(!expected||expected.length<32||!supplied)return false;
 return timingSafeEqual(createHash("sha256").update(supplied).digest(),createHash("sha256").update(expected).digest());
}
export async function POST(request:Request){
 if(!authorized(request))return NextResponse.json({ok:false},{status:401});
 // No production call recording or client-writing until the staging verification is approved.
 if(process.env.VERCEL_ENV!=="preview"||process.env.LUMACLEAN_VOICE_STAGING_ENABLED!=="true")return NextResponse.json({ok:false,error:"STAGING_ONLY"},{status:403});
 const raw=await request.text();
 if(raw.length>8000)return NextResponse.json({ok:false},{status:413});
 let data:unknown;try{data=JSON.parse(raw);}catch{return NextResponse.json({ok:false},{status:400});}
 const result=inputSchema.safeParse(data);
 if(!result.success)return NextResponse.json({ok:false,error:"INVALID_LEAD_INPUT"},{status:400});
 const v=result.data,normalized=normalizedPhone(v.phone);
 if(!normalized)return NextResponse.json({ok:false,error:"INVALID_PHONE"},{status:400});
 const db=getDatabase();
 const submissionId=createHash("sha256").update("elevenlabs:"+v.conversationId).digest("hex");
 const hash=createHash("sha256").update(JSON.stringify({phone:normalized,name:v.name,service:v.service,area:v.area,notes:v.notes})).digest("hex");
 const existing=await db.lead.findUnique({where:{submissionId},select:{id:true,reference:true,submissionHash:true}});
 if(existing)return existing.submissionHash===hash?NextResponse.json({ok:true,reference:existing.reference,created:false,bookingConfirmed:false}):NextResponse.json({ok:false,error:"IDEMPOTENCY_CONFLICT"},{status:409});
 const saved=await db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`voice:${submissionId}`}))::text`;
   const dup=await tx.lead.findUnique({where:{submissionId},select:{id:true,reference:true,submissionHash:true}});
   if(dup)return{...dup,created:false};
   const service=v.service?await tx.service.findUnique({where:{code:v.service},select:{id:true,active:true}}):null;
   if(v.service&&!service?.active)throw new Error("SERVICE_UNAVAILABLE");
   const reference=`LC-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${randomUUID().slice(0,8).toUpperCase()}`;
   const lead=await tx.lead.create({data:{reference,submissionId,submissionHash:hash,name:v.name,phone:v.phone,normalizedPhone:normalized,locale:"sr",requestKind:v.service?"CLEANING":"CONTACT_REQUEST",humanReviewRequired:true,consentAt:new Date(),serviceId:service?.id??null,area:v.area,comment:`[VOICE / ELEVENLABS] ${v.notes}`,channel:"OTHER",entrySource:"DIRECT"}});
   await enqueueLeadReview(tx,{...lead,service:v.service??undefined,area:v.area??undefined,estimatedPrice:null});
   await writeAudit(tx,{type:"SYSTEM",key:"voice-elevenlabs-staging"},{action:"LEAD_CREATED",entityType:"Lead",entityId:lead.id});
   return{id:lead.id,reference,submissionHash:hash,created:true};
 },{maxWait:10000,timeout:30000});
 if(saved.submissionHash!==hash)return NextResponse.json({ok:false,error:"IDEMPOTENCY_CONFLICT"},{status:409});
 await publishWebsiteLead(db,saved.id);
 return NextResponse.json({ok:true,reference:saved.reference,created:saved.created,bookingConfirmed:false,requiresHumanReview:true},{headers:{"Cache-Control":"no-store"}});
}
