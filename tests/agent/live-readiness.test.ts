import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient,type Prisma} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {cleanerReadiness,readiness,websiteSummary,previewBookingReady,type Check} from '../../src/lib/agent/readiness';
import {previewTestAllowed,signLiveProof,validLiveProof,assertPreviewBatch} from '../../src/lib/agent/live-proof';
import {runLiveBookingTest,cleanupLiveTest} from '../../src/lib/agent/live-test';
import {aiSettingsSchema,runAiSettings} from '../../src/lib/agent/settings';
import {runInboxCommand,acceptMessage} from '../../src/lib/agent/inbox';
import {estimateDuration,type DurationConfig} from '../../src/lib/domain/duration';
import {executeAgentTool,json,stateOf,type ToolContext} from '../../src/lib/agent/tools';
import {signLocation} from '../../src/lib/services/google-places';
import {routingSnapshot} from '../../src/lib/services/routing-planning';
import {RoutingService} from '../../src/lib/services/route-cache';
import {preparationRequests,type RoutingOrder} from '../../src/lib/domain/logistics';
import {routeSample,type RoutingProvider,type RouteRequest,type RouteResult} from '../../src/lib/domain/routing';
import {localInstant} from '../../src/lib/domain/crm';
const secret='test-only-live-readiness-secret-32-characters';
const previewEnv={VERCEL_ENV:'preview',AI_LIVE_TEST_SECRET:secret,DATABASE_URL:'postgresql://test:test@ep-preview.c-14.us-east-1.aws.neon.tech/neondb',AI_LIVE_TEST_DATABASE_HOST:'ep-preview.c-14.us-east-1.aws.neon.tech'};

test('Preview can prove native failover without weakening AUTO or other booking guards',()=>{
 const checks:Check[]=['credentials','primary','fallback','places','transit','cleaners','duration','liveBooking'].map(id=>({id,label:id,status:['primary','duration','liveBooking'].includes(id)?'BLOCKS_AUTO':'READY',detail:''}));
 assert(previewBookingReady(checks,true));assert(checks.some(c=>c.status==='BLOCKS_AUTO'));
 assert(!previewBookingReady(checks,false));
 for(const id of ['fallback','credentials','places','transit','cleaners'])assert(!previewBookingReady(checks.map(c=>c.id===id?{...c,status:'BLOCKS_AUTO'}:c),true),id+' remains required');
 assert(!previewBookingReady(checks.filter(c=>c.id!=='fallback'),true));
});
test('Preview guard requires explicit environment and strong signing credential',()=>{
 assert.equal(previewTestAllowed({VERCEL_ENV:'production',AI_LIVE_TEST_SECRET:secret}),false);
 assert.equal(previewTestAllowed({VERCEL_ENV:'preview',AI_LIVE_TEST_SECRET:'short'}),false);
 assert.equal(previewTestAllowed(previewEnv),true);
 assert.equal(previewTestAllowed({...previewEnv,DATABASE_URL:'postgresql://test:test@ep-production.c-14.us-east-1.aws.neon.tech/neondb'}),false);
});
test('a production live test rejects before the first database read or write',async()=>{
 const previous=process.env.VERCEL_ENV;process.env.VERCEL_ENV='production';
 try{await assert.rejects(runLiveBookingTest(new Proxy({},{get(){throw Error('DATABASE_TOUCHED');}}) as PrismaClient,'owner','2026-10-10'),/PREVIEW_TEST_ONLY/);}finally{process.env.VERCEL_ENV=previous;}
});
test('proof is authenticated, tied to configuration, completed cleanup and expiry',()=>{
 const old={...process.env};Object.assign(process.env,previewEnv);
 try{const config='a'.repeat(64),proof=signLiveProof(config,randomUUID());assert(validLiveProof(proof,config));assert(!validLiveProof({...proof,cleaned:false},config));assert(!validLiveProof(proof,'b'.repeat(64)));assert(!validLiveProof({...proof,at:new Date(Date.now()-8*86400000).toISOString()},config));assert(!validLiveProof({...proof,signature:'0'.repeat(64)},config));assert(!validLiveProof({...proof,signature:'invalid'},config));}finally{for(const k of Object.keys(process.env))if(!(k in old))delete process.env[k];Object.assign(process.env,old);}
});
test('cleaner readiness requires contacts, recurring schedule and coordinates but no payout',()=>{
 const c={active:true,name:'Cleaner',phone:'+381601234567',homeAddress:'Beograd',homeCoordinatesConfirmed:true,homeLatitude:44.81,homeLongitude:20.46,languages:[],payoutPercent:null,availability:[{kind:'WEEKLY',startMinute:480,endMinute:1080}]};
 assert(cleanerReadiness(c).ready);assert(!cleanerReadiness({...c,homeCoordinatesConfirmed:false}).ready);assert(!cleanerReadiness({...c,homeCoordinatesConfirmed:undefined}).ready);assert(!cleanerReadiness({...c,phone:''}).ready);assert(!cleanerReadiness({...c,availability:[{kind:'AVAILABLE',startMinute:480,endMinute:1080}]}).ready);assert(!cleanerReadiness({...c,homeLatitude:null}).coordinates);assert(!cleanerReadiness({...c,homeLatitude:999}).coordinates);assert(!cleanerReadiness({...c,active:false}).ready);
});
test('unknown extras are partial and unschedulable while a standard order is configured',()=>{
 const r:DurationConfig={id:'r',serviceId:'regular',version:1,active:true,minArea:1,maxArea:100,referenceArea:100,cleanerCount:2,baseMinutes:150,minutesPerSquare:0,reserveMinutes:10,soilMultipliers:{NORMAL:1},extraMinutes:{oven:null}};
 const input={serviceId:'regular',area:50,requiredCleaners:2,soilLevel:'NORMAL',extras:[]};
 assert.equal(estimateDuration(input,[r],{showPartial:true})?.confidence,'CONFIGURED');
 const partial=estimateDuration({...input,extras:[{code:'oven',quantity:1}]},[r],{showPartial:true});assert.equal(partial?.confidence,'PARTIALLY_CONFIGURED');assert.equal(partial?.schedulingAllowed,false);assert.equal(r.extraMinutes.oven,null);
});
test('starter duration cannot activate without explicit confirmation and reserve',()=>{
 assert(!aiSettingsSchema.safeParse({action:'starter-duration',service:'regular',reserveMinutes:10}).success);
 assert(!aiSettingsSchema.safeParse({action:'starter-duration',service:'regular',confirm:true}).success);
 assert(aiSettingsSchema.safeParse({action:'starter-duration',service:'deep',reserveMinutes:0,confirm:true}).success);
});
test('Website readiness has five systems and warnings do not become hard blockers',()=>{
 const ids=['master','credentials','primary','fallback','places','transit','duration','pricing','cleaners','settings','tests','scope','channels','liveBooking'];
 const checks=ids.map(id=>({id,label:id,detail:'',status:'READY' as const}));assert.deepEqual(websiteSummary(checks),{ready:5,total:5});assert.equal(websiteSummary(checks.map(c=>c.id==='transit'?{...c,status:'BLOCKS_AUTO' as const}:c)).ready,4);
});

const url=process.env.READINESS_TEST_DATABASE_URL;
test('targeted live-readiness database boundaries',{skip:!url},async t=>{
 assert.equal(new URL(url!).hostname,'ep-lively-mountain-b8x8hoxw-pooler.c-14.us-east-1.aws.neon.tech');
 const env={...process.env};Object.assign(process.env,{VERCEL_ENV:'preview',AI_LIVE_TEST_SECRET:secret,DATABASE_URL:url,AI_LIVE_TEST_DATABASE_HOST:new URL(url!).hostname.replace('-pooler.','.'),AI_AGENT_ENABLED:'true',PRIMARY_AGENT_MODEL:'test',FALLBACK_AGENT_MODEL:'backup',GOOGLE_MAPS_SERVER_API_KEY:'',BETTER_AUTH_SECRET:secret});
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:8})});
 const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}}),owner=await db.user.create({data:{name:'Readiness verifier',email:`readiness-${randomUUID()}@example.invalid`,role:'ADMIN'}});
 const before=[await db.client.count(),await db.lead.count(),await db.order.count()],ruleIds:string[]=[],crewIds:string[]=[],batchIds:string[]=[];
 const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10),window={date,from:date+'T10:00',to:date+'T16:00'};
 try{
  await t.test('owner confirmation creates versioned active rules and audit with NULL extras',async()=>{
   assert.equal(await db.durationRule.count({where:{active:true}}),0);
   await assert.rejects(runAiSettings(db,owner.id,{action:'starter-duration',service:'regular',reserveMinutes:10}),/confirm/);
   for(const service of ['regular','deep']){const result=await runAiSettings(db,owner.id,{action:'starter-duration',service,reserveMinutes:10,confirm:true}) as {id:string};ruleIds.push(result.id);const r=await db.durationRule.findUniqueOrThrow({where:{id:result.id}});assert(r.active);assert.equal(r.cleanerCount,2);assert.equal(r.baseMinutes,service==='regular'?150:480);assert.equal(r.reserveMinutes,10);assert(Object.values(r.extraMinutes as object).every(v=>v===null));assert.equal(await db.auditLog.count({where:{entityId:r.id,action:'DURATION_RULE_CREATED'}}),1);}
  });
  await t.test('confirmed duration stops being UNCONFIGURED even before crew onboarding',async()=>{const r=await readiness(db);assert.equal(r.checks.find(c=>c.id==='duration')?.status,'READY');assert.equal(r.checks.find(c=>c.id==='cleaners')?.status,'BLOCKS_AUTO');});
  await t.test('two ready cleaners do not require payoutPercent',async()=>{for(let n=0;n<2;n++){const c=await db.cleaner.create({data:{name:`Readiness crew ${n}`,phone:`+38160999110${n}`,homeAddress:'Synthetic start',homeLatitude:44.82,homeLongitude:20.45,payoutPercent:null,availability:{create:Array.from({length:7},(_,i)=>({kind:'WEEKLY',weekday:i+1,startMinute:480,endMinute:1080}))}}});crewIds.push(c.id);}assert.equal((await readiness(db)).checks.find(c=>c.id==='cleaners')?.status,'READY');});
  await t.test('missing Google is a hard blocker and prevents live test without creating a batch',async()=>{const r=await readiness(db);assert.equal(r.checks.find(c=>c.id==='transit')?.status,'BLOCKS_AUTO');const count=await db.agentLiveTest.count();await assert.rejects(runLiveBookingTest(db,owner.id,date),/LIVE_TEST_BLOCKED/);assert.equal(await db.agentLiveTest.count(),count);});
  await t.test('server rejects forged AUTO confirmation with blockers and preserves SHADOW',async()=>{await assert.rejects(runInboxCommand(db,owner.id,{action:'mode',mode:'AUTO',confirmAuto:true}),/AUTO_BLOCKED/);assert.equal((await db.businessSettings.findUniqueOrThrow({where:{id:'default'}})).aiAgentMode,'SHADOW');});
  await t.test('synthetic batch cannot impersonate another conversation',async()=>{const batch=randomUUID();batchIds.push(batch);await db.agentLiveTest.create({data:{id:batch}});const foreign=await db.conversation.create({data:{channel:'WEBSITE'}});try{await assert.rejects(assertPreviewBatch(db,batch,foreign.id),/LIVE_TEST_NAMESPACE_INVALID/);}finally{await db.conversation.delete({where:{id:foreign.id}});}});
  await t.test('kill switch changed during slot checks prevents the first booking mutation; namespace cleanup preserves existing records',async()=>{
   const batch=randomUUID();batchIds.push(batch);const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:`live-test:${batch}`}});await db.agentLiveTest.create({data:{id:batch,conversationId:c.id}});
   const m=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text:'Synthetic readiness inquiry'}}),leaseKey=randomUUID(),job=await db.agentJob.create({data:{conversationId:c.id,messageId:m.id,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+180000)}});
   let ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:0,mode:'AUTO',state:stateOf(c),previewTestId:batch};
   const qualification={service:'regular',area:50,soilLevel:'NORMAL',extras:[],urgent:false};
   await executeAgentTool(db,ctx,'createOrUpdateLead',{intent:'cleaning',name:`Preview test ${batch}`,phone:'+381609991199'});assert.equal((await executeAgentTool(db,ctx,'calculatePrice',qualification)).total,4600);assert.equal((await executeAgentTool(db,ctx,'estimateDuration',{})).minutes,150);
   ctx.state.address={fullAddress:'Synthetic address, Beograd',proof:signLocation({address:'Synthetic address, Beograd',placeId:'readiness-synthetic-place',latitude:44.81,longitude:20.46,expires:Date.now()+1800000})};await db.conversation.update({where:{id:c.id},data:{state:json(ctx.state)}});
   const snapshot=await routingSnapshot(db,date),candidate:RoutingOrder={id:'new-order',addressId:'new-address',status:'DRAFT',scheduleMode:'FLEXIBLE',scheduledStart:null,windowFrom:localInstant(window.from),windowTo:localInstant(window.to),manualDurationMinutes:150,estimatedDurationMinutes:null,requiredCleaners:2,travelBufferMinutes:30,cleaningReserveMinutes:10,cleanerIds:[],point:{latitude:44.81,longitude:20.46,placeId:'readiness-synthetic-place'},label:'Synthetic',reference:'Synthetic',updatedAt:''};
   const verified=(r:RouteRequest):RouteResult=>({status:'VERIFIED',durationSeconds:1200,distanceMeters:3000,source:'Google',sampledAt:routeSample(r),calculatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+600000).toISOString()});
   const routes:RoutingProvider={getTravelTime:async r=>verified(r),getRouteDetails:async r=>({result:verified(r),steps:[]}),getRouteMatrix:async(origins,destinations,mode,at,timing)=>origins.map(origin=>destinations.map(destination=>verified({origin,destination,mode,at,timing})))};
   await new RoutingService(db,routes).prepare(preparationRequests(snapshot,[candidate]));
   const slots=await executeAgentTool(db,ctx,'findAvailableSlots',window);assert(!slots.error,JSON.stringify(slots));const token=ctx.state.slots![0].token;assert((await executeAgentTool(db,ctx,'validateSlot',{slotToken:token})).recap);
   const latest=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),confirmation=await acceptMessage(db,latest,{id:randomUUID(),text:'Подтверждаю запись',locale:'ru',confirmationNonce:ctx.state.pending!.nonce});await db.agentJob.update({where:{id:job.id},data:{status:'DONE',leaseUntil:null,leaseKey:null}});
   const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),newLease=randomUUID(),newJob=await db.agentJob.update({where:{messageId:confirmation.messageId},data:{status:'RUNNING',leaseKey:newLease,leaseUntil:new Date(Date.now()+180000)}});ctx={...ctx,jobId:newJob.id,leaseKey:newLease,revision:current.revision,state:stateOf(current)};
   let toggled=false;
   const racingDb={$transaction:(fn:(tx:Prisma.TransactionClient)=>Promise<unknown>,options?:{timeout?:number;maxWait?:number})=>db.$transaction(tx=>fn(new Proxy(tx,{get(target,property){if(property==='durationRule')return new Proxy(target.durationRule,{get(model,key){if(key==='findMany')return async(args:Parameters<typeof model.findMany>[0])=>{const result=await model.findMany(args);await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'OFF'}});toggled=true;return result;};return Reflect.get(model,key);}});return Reflect.get(target,property);}})),options)} as unknown as PrismaClient;
   await assert.rejects(executeAgentTool(racingDb,ctx,'createOrder',{}),/AGENT_CONTROL_CHANGED/);assert(toggled);assert.equal(await db.order.count(),before[2]);assert.equal(await db.client.count(),before[0]);
   await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'SHADOW'}});
   // Mocked routes stay exclusively on this isolated verification branch; this is not a live proof.
   assert((await executeAgentTool(db,ctx,'createOrder',{})).booked);
   assert.equal(await db.order.count(),before[2]+1);assert.equal(await db.client.count(),before[0]+1);
   assert.equal(await db.notification.count({where:{conversationId:c.id}}),0);
   await cleanupLiveTest(db,batch);assert.equal(await db.conversation.count({where:{id:c.id}}),0);assert.deepEqual([await db.client.count(),await db.lead.count(),await db.order.count()],before);
   await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'SHADOW'}});
  });
 }finally{
  for(const batch of batchIds){await cleanupLiveTest(db,batch);await db.agentLiveTest.delete({where:{id:batch}});}
  await db.cleanerAvailability.deleteMany({where:{cleanerId:{in:crewIds}}});await db.cleaner.deleteMany({where:{id:{in:crewIds}}});await db.durationRule.deleteMany({where:{id:{in:ruleIds}}});
  await db.user.update({where:{id:owner.id},data:{active:false}});await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:settings.aiAgentMode,aiLiveTestProof:settings.aiLiveTestProof??undefined}});
  await db.$disconnect();for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);
 }
});
