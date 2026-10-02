import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import type {Prisma} from '@/generated/prisma/client';
import {AgentError} from './contracts';
import {durationConfig} from '@/lib/services/duration-engine';
const proofSchema=z.object({version:z.literal(1),config:z.string().length(64),at:z.string().datetime(),batch:z.string().uuid(),passed:z.literal(true),cleaned:z.literal(true),signature:z.string().regex(/^[a-f0-9]{64}$/)}).strict();
export type LiveProof=z.infer<typeof proofSchema>;
export function previewTestAllowed(env:Record<string,string|undefined>=process.env){
  if(env.VERCEL_ENV!=='preview'||(env.AI_LIVE_TEST_SECRET?.length??0)<32)return false;
  try{const host=new URL(env.DATABASE_URL??'').hostname.replace('-pooler.','.');return /^ep-[a-z0-9-]+\.[a-z0-9.-]+\.neon\.tech$/.test(env.AI_LIVE_TEST_DATABASE_HOST??'')&&host===env.AI_LIVE_TEST_DATABASE_HOST;}catch{return false;}
}
function signature(data:Omit<LiveProof,'signature'>,secret:string){return createHmac('sha256',secret).update(JSON.stringify(data)).digest('hex');}
export function signLiveProof(config:string,batch:string,secret=process.env.AI_LIVE_TEST_SECRET){
  if(!previewTestAllowed()||!secret)throw new AgentError('PREVIEW_TEST_ONLY');
  const data={version:1 as const,config,at:new Date().toISOString(),batch,passed:true as const,cleaned:true as const};
  return{...data,signature:signature(data,secret)};
}
export function validLiveProof(value:unknown,config:string,secret=process.env.AI_LIVE_TEST_SECRET){
  const parsed=proofSchema.safeParse(value);if(!parsed.success||!secret)return false;
  const {signature:actual,...data}=parsed.data,age=Date.now()-Date.parse(data.at);
  return data.config===config&&age>=0&&age<7*86400000&&timingSafeEqual(Buffer.from(actual,'hex'),Buffer.from(signature(data,secret),'hex'));
}
// Hash contacts/configuration; reports expose only this opaque digest. IDs differ between DB branches.
export async function liveConfigFingerprint(db:Prisma.TransactionClient){
  const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  const services=await db.service.findMany({where:{code:{in:settings.aiAllowedServices}},include:{durationRules:{where:{active:true}}},orderBy:{code:'asc'}});
  const cleaners=await db.cleaner.findMany({where:{active:true},include:{availability:true},orderBy:{phone:'asc'}});
  const config={version:1,source:process.env.AI_VERIFIED_SOURCE_FINGERPRINT,services:services.map(s=>({code:s.code,active:s.active,rules:s.durationRules.map(r=>{const rule=durationConfig(r);return {minArea:rule.minArea,maxArea:rule.maxArea,referenceArea:rule.referenceArea,cleanerCount:rule.cleanerCount,baseMinutes:rule.baseMinutes,minutesPerSquare:rule.minutesPerSquare,soilMultipliers:rule.soilMultipliers,extraMinutes:rule.extraMinutes,reserveMinutes:rule.reserveMinutes,unknownExtraReserveMinutes:rule.unknownExtraReserveMinutes};}).sort((a,b)=>a.minArea-b.minArea)})),cleaners:cleaners.map(c=>({name:c.name,phone:c.phone,home:c.homeAddress,lat:String(c.homeLatitude),lng:String(c.homeLongitude),mode:c.defaultTravelMode,hours:c.availability.map(a=>({kind:a.kind,weekday:a.weekday,date:a.date?.toISOString(),start:a.startMinute,end:a.endMinute})).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))})),timezone:settings.timezone,buffer:settings.defaultTravelBufferMinutes,workday:[settings.workdayStartMinute,settings.workdayEndMinute],models:[process.env.PRIMARY_AGENT_MODEL,process.env.FALLBACK_AGENT_MODEL],google:createHash('sha256').update(process.env.GOOGLE_MAPS_SERVER_API_KEY??'').digest('hex')};
  return createHash('sha256').update(JSON.stringify(config,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v)).digest('hex');
}
export async function assertPreviewBatch(tx:Prisma.TransactionClient,batchId:string,conversationId:string){
  if(!previewTestAllowed())throw new AgentError('PREVIEW_TEST_ONLY');
  const batch=await tx.agentLiveTest.findUnique({where:{id:batchId}});
  const c=await tx.conversation.findUniqueOrThrow({where:{id:conversationId}});
  if(!batch||batch.status!=='RUNNING'||batch.conversationId!==c.id||Date.now()-batch.startedAt.getTime()>5*60000||c.channel!=='WEBSITE'||c.externalThreadId!==`live-test:${batchId}`||c.anonymousHash||c.identityVerified)throw new AgentError('LIVE_TEST_NAMESPACE_INVALID');
}
