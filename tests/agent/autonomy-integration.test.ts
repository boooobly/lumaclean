import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {pgConnectionString} from '../../src/lib/database/connection';
import {executeAgentTool,json,type ToolContext} from '../../src/lib/agent/tools';
import {acceptMessage,runInboxCommand} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
import {AgentError,type AgentState} from '../../src/lib/agent/contracts';
import type {AIProvider,Completion} from '../../src/lib/agent/providers';
import {signLocation} from '../../src/lib/services/google-places';
import {operationalSummary} from '../../src/lib/agent/conversation-memory';
const url=process.env.AUTONOMY_TEST_DATABASE_URL;
test('autonomy domain actions on isolated Preview',{skip:!url},async t=>{
 assert(new URL(url!).hostname.startsWith('ep-wispy-river-b8xwqy9q'));process.env.AI_AGENT_ENABLED='true';
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:3})}),owned:string[]=[];
 const owner=await db.user.findFirstOrThrow({where:{active:true,role:'ADMIN'}});
 async function fixture(state:AgentState={},text='Synthetic customer request'){
  const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'autonomy-domain:'+randomUUID(),state:json(state)}});owned.push(c.id);
  const m=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text}}),leaseKey=randomUUID();
  const job=await db.agentJob.create({data:{conversationId:c.id,messageId:m.id,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+180000)}});
  const ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:0,mode:'AUTO',state};return{c,ctx};
 }
 const selected=process.env.AUTONOMY_INTEGRATION_CASE;
 const check=(name:string,fn:()=>Promise<void>)=>t.test(name,{skip:!!selected&&!name.includes(selected)},fn);
 try{
  await check('soft review deduplicates, retains AI and blocks booking; approval keeps safety guards',async()=>{
   const {c,ctx}=await fixture();for(let n=0;n<3;n++)assert.equal((await executeAgentTool(db,ctx,'requestHumanHandoff',{reason:'PAYMENT_REVIEW'})).continuesIntake,true);
   const h=await db.humanHandoff.findFirstOrThrow({where:{conversationId:c.id}});assert.equal(h.reason,'SOFT:PAYMENT_REVIEW');assert.equal(await db.humanHandoff.count({where:{conversationId:c.id}}),1);assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).control,'AI_CONTROL');
   assert.equal((await executeAgentTool(db,ctx,'createOrder',{})).error,'REVIEW_REQUIRED');
   await runInboxCommand(db,owner.id,{action:'resolveReview',id:c.id,handoffId:h.id,decision:'APPROVED',note:'Проверены условия оплаты для этой заявки.'});
   const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert.equal(live.control,'AI_CONTROL');ctx.revision=live.revision;
   assert.equal((await executeAgentTool(db,ctx,'createOrder',{})).error,'EXPLICIT_CONFIRMATION_REQUIRED');assert.equal(live.orderId,null);
  });
  await check('no slots asks for another date without a blocking review or takeover',async()=>{
   const {c,ctx}=await fixture();const result=await executeAgentTool(db,ctx,'requestHumanHandoff',{reason:'NO_SLOTS'});assert(result.clarificationRequired);assert(ctx.responseText?.includes('другой день'));assert.equal(await db.humanHandoff.count({where:{conversationId:c.id}}),0);assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).control,'AI_CONTROL');
  });
  await check('actual availability search clears stale slots when the requested window cannot fit cleaning',async()=>{
   const date=new Date(Date.now()+5*86400000).toISOString().slice(0,10);
   const {c,ctx}=await fixture({draftFacts:{service:'deep',area:50,soilLevel:'NORMAL',extras:[],extrasConfirmed:true,requestedDate:date}});
   assert(!(await executeAgentTool(db,ctx,'calculatePrice',{service:'deep',area:50,soilLevel:'NORMAL',extras:[],urgent:false})).error);
   assert(!(await executeAgentTool(db,ctx,'estimateDuration',{})).error);
   ctx.state.address={fullAddress:'Synthetic availability fixture',proof:signLocation({address:'Synthetic availability fixture',placeId:'autonomy-domain-fixture',latitude:44.81,longitude:20.46,expires:Date.now()+1800000})};
   ctx.state.slots=[{token:randomUUID(),start:date+'T10:00:00Z',duration:ctx.state.duration!.minutes}];ctx.state.selectedSlotToken=ctx.state.slots[0].token;
   await db.conversation.update({where:{id:c.id},data:{state:json(ctx.state)}});
   const result=await executeAgentTool(db,ctx,'findAvailableSlots',{date,from:date+'T16:30',to:date+'T17:00'});
   assert.equal(result.error,'NO_SLOTS');assert(!ctx.state.slots);assert(!ctx.state.selectedSlotToken);assert(ctx.state.quote);
   assert.equal(await db.humanHandoff.count({where:{conversationId:c.id}}),0);assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).control,'AI_CONTROL');
  });
  await check('human correction values must match the attributed statement, not merely a matching excerpt',async()=>{
   const {c,ctx}=await fixture({draftFacts:{service:'regular',area:60,soilLevel:'NORMAL',extras:[],extrasConfirmed:true}});
   const admin=await db.message.create({data:{conversationId:c.id,author:'ADMIN',userId:owner.id,text:'Хорошо, окна тогда тоже добавим. Их 3 больших.'}});
   await db.conversation.update({where:{id:c.id},data:{summary:operationalSummary(ctx.state,null,{admin:{id:admin.id,text:admin.text}})}});
   const correction=(largeCount:number)=>({reviewedMessageIds:[admin.id],corrections:[{messageId:admin.id,evidence:'3 больших',facts:{windowCleaning:{requested:true,largeCount}}}]});
   assert.equal((await executeAgentTool(db,ctx,'reconcileHumanContext',correction(30))).error,'HUMAN_CONTEXT_REQUIRED');assert(!ctx.state.draftFacts?.windowCleaning);
   assert(!(await executeAgentTool(db,ctx,'reconcileHumanContext',correction(3))).error);
   const after=(await db.conversation.findUniqueOrThrow({where:{id:c.id}})).state as AgentState;
   assert.equal(after.draftFacts?.windowCleaning?.largeCount,3);assert.equal(after.draftFacts?.area,60);
  });
  await check('furniture FAQ cannot mark booking intent; real booking intent creates Lead and soft review',async()=>{
   const faq=await fixture({},'Сколько стоит химчистка дивана?');assert.equal((await executeAgentTool(db,faq.ctx,'markUpholsteryInquiry',{evidence:'Сколько стоит химчистка дивана?'})).error,'CUSTOMER_FACTS_REQUIRED');assert(!( (await db.conversation.findUniqueOrThrow({where:{id:faq.c.id}})).state as AgentState).upholsteryInquiry);
   const booking=await fixture({},'Можно почистить диван вместе с уборкой?');await executeAgentTool(db,booking.ctx,'markUpholsteryInquiry',{evidence:'Можно почистить диван вместе с уборкой?'});await executeAgentTool(db,booking.ctx,'createOrUpdateLead',{intent:'cleaning'});
   const live=await db.conversation.findUniqueOrThrow({where:{id:booking.c.id}});assert(live.leadId);assert.equal(live.control,'AI_CONTROL');assert.equal((await executeAgentTool(db,booking.ctx,'createOrder',{})).error,'UPHOLSTERY_REVIEW_REQUIRED');assert.equal(live.orderId,null);
  });
  await check('hard handoff after soft review remains visible and blocks subsequent operations',async()=>{
   const {c,ctx}=await fixture();await executeAgentTool(db,ctx,'requestReview',{reason:'CUSTOM_EXTRA'});await executeAgentTool(db,ctx,'requestHumanHandoff',{reason:'COMPLAINT'});assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).control,'HUMAN_CONTROL');assert.equal(await db.humanHandoff.count({where:{conversationId:c.id,reason:'COMPLAINT'}}),1);await assert.rejects(executeAgentTool(db,ctx,'createOrder',{}),/AGENT_CONTROL_CHANGED/);
   await acceptMessage(db,c,{id:randomUUID(),text:'Добавляю условие после передачи.'});assert(await db.message.count({where:{conversationId:c.id,author:'CLIENT',text:'Добавляю условие после передачи.'}}));
  });
  await check('provider outage preserves AI control, facts and exactly one safe response',async()=>{
   const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'autonomy-domain:'+randomUUID()}});owned.push(c.id);await acceptMessage(db,c,{id:randomUUID(),text:'Какие средства используете?'});const claim=await claimJob(db,c.id);assert(claim);
   let calls=0;const provider:AIProvider={name:'synthetic',model:'test',complete:async()=>{calls++;throw new AgentError('PROVIDER_TIMEOUT_OR_NETWORK');}};
   await runClaimedJob(db,claim,[provider,provider]);assert.equal(calls,2);assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).control,'AI_CONTROL');assert.equal(await db.humanHandoff.count({where:{conversationId:c.id}}),0);assert.equal(await db.message.count({where:{conversationId:c.id,author:'AI'}}),1);assert.equal(await db.agentToolTrace.count({where:{conversationId:c.id,tool:'createOrder'}}),0);
  });
  await check('repair-returned business tool never executes and is not sent as a claim',async()=>{
   const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'autonomy-domain:'+randomUUID()}});owned.push(c.id);await acceptMessage(db,c,{id:randomUUID(),text:'Здравствуйте'});const claim=await claimJob(db,c.id);assert(claim);let calls=0;
   const provider:AIProvider={name:'synthetic',model:'test',complete:async():Promise<Completion>=>({provider:'synthetic',model:'test',text:++calls===1?'Я понял.':'Запись подтверждена.',toolCalls:calls===1?[]:[{id:randomUUID(),name:'createOrder',arguments:'{}'}],inputTokens:1,cachedInputTokens:0,outputTokens:1,latencyMs:1,estimatedCostUsd:0})};
   await runClaimedJob(db,claim,[provider,provider]);assert.equal(calls,2);assert.equal(await db.agentToolTrace.count({where:{conversationId:c.id,tool:'createOrder'}}),0);assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).orderId,null);assert(!(await db.message.findFirstOrThrow({where:{conversationId:c.id,author:'AI'}})).text.includes('Запись подтверждена'));
  });
 }finally{
  for(const id of owned){const c=await db.conversation.findUniqueOrThrow({where:{id}});assert(c.externalThreadId?.startsWith('autonomy-domain:'));assert.equal(c.orderId,null);await db.$transaction(async tx=>{await tx.notification.deleteMany({where:{conversationId:id}});await tx.agentToolTrace.deleteMany({where:{conversationId:id}});await tx.aIInvocation.deleteMany({where:{conversationId:id}});await tx.shadowSuggestion.deleteMany({where:{conversationId:id}});await tx.agentSlot.deleteMany({where:{conversationId:id}});await tx.humanHandoff.deleteMany({where:{conversationId:id}});await tx.agentJob.deleteMany({where:{conversationId:id}});await tx.message.updateMany({where:{conversationId:id},data:{responseToMessageId:null}});await tx.message.deleteMany({where:{conversationId:id}});await tx.conversation.delete({where:{id}});if(c.leadId){await tx.leadExtra.deleteMany({where:{leadId:c.leadId}});await tx.lead.delete({where:{id:c.leadId}});}});}
  await db.$disconnect();
 }
});
