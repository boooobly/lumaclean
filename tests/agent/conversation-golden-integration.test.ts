import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {acceptMessage,publicConversation} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
import type {AIProvider,Completion} from '../../src/lib/agent/providers';
import type {AgentState,ToolName} from '../../src/lib/agent/contracts';
const texts=['Здравствуйте, хочу заказать клининг','Обычная уборка','88','Да, мне нужно холодильник помыть и духовку. Сколько это всё будет стоить?','Обычное загрязнение','Да, я же написал','Да, мне нужно холодильник помыть и духовку. Сколько это всё будет стоить?'];
const url=process.env.RELIABILITY_TEST_DATABASE_URL;
test('exact golden replay through persistence, jobs, domain tools, Lead and calculator',{skip:!url},async()=>{
 assert(new URL(url!).hostname.startsWith('ep-wispy-river-b8xwqy9q'));process.env.AI_AGENT_ENABLED='true';
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:3})});
 const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
 assert.equal(settings.aiAgentMode,'AUTO');assert.equal((settings.aiChannelModes as Record<string,string>).WEBSITE,'AUTO');
 const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'reliability-test:'+randomUUID(),displayAlias:'Mila'}});
 const completion=(name:ToolName,args:unknown):Completion=>({text:'',toolCalls:[{id:randomUUID(),name,arguments:JSON.stringify(args)}],provider:'fixture',model:'fixture',inputTokens:1,cachedInputTokens:0,outputTokens:1,latencyMs:1,estimatedCostUsd:0});
 const provider:AIProvider={name:'fixture',model:'fixture',complete:async messages=>{
  const user=messages.findLast(m=>m.role==='user')?.content??'';
  if(user===texts[0])return messages.at(-1)?.role==='tool'?completion('requestCustomerInput',{intent:'SERVICE_TYPE'}):completion('getBusinessInfo',{});
  if(/холодильник/iu.test(user))return messages.at(-1)?.role==='tool'?completion('requestCustomerInput',{intent:'SOIL_LEVEL'}):completion('recordCustomerFacts',{facts:{extras:[{code:'fridge',quantity:1},{code:'oven',quantity:1}],extrasConfirmed:true},evidence:user});
  assert.fail('Deterministic qualification must handle all subsequent golden turns');
 }};
 const snapshots:Record<string,unknown>[]=[];
 try{
  for(const [i,text] of texts.entries()){
   const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),requestId=randomUUID();
   const accepted=await acceptMessage(db,live,{id:requestId,text});const claim=await claimJob(db,c.id);assert(claim);
   await runClaimedJob(db,claim,[provider,provider]);
   const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=current.state as AgentState;
   const reply=await db.message.findUniqueOrThrow({where:{responseToMessageId:accepted.messageId}});
   const tools=await db.agentToolTrace.findMany({where:{jobId:claim.job.id},select:{tool:true,outcome:true}});
   snapshots.push({turn:i+1,facts:state.draftFacts,nextInput:state.nextInput,revision:current.revision,tools,quote:state.quote?.total,reply:reply.text});
   writeFileSync('qa-output/conversation-golden-persisted.json',JSON.stringify({scope:'Controlled native-shaped provider proposals; actual database/domain actions, not live-model proof',snapshots},null,2));
   assert.equal(current.control,'AI_CONTROL');assert.equal(current.orderId,null);assert.equal(current.revision,i+1);
   if(i>=1)assert.equal(state.draftFacts?.service,'regular');if(i>=2)assert.equal(state.draftFacts?.area,88);
   if(i>=3){assert.deepEqual([...(state.draftFacts?.extras??[])].sort((a,b)=>a.code.localeCompare(b.code)),[{code:'fridge',quantity:1},{code:'oven',quantity:1}]);assert.equal(state.draftFacts?.extrasConfirmed,true);assert.notEqual(state.nextInput,'EXTRAS');}
   if(i>=4){assert.equal(state.draftFacts?.soilLevel,'NORMAL');assert.equal(state.quote?.total,9200);assert.equal(state.quote.base,7200);assert.deepEqual(state.quote.breakdown?.map(e=>e.unitPrice),[1000,1000]);assert(reply.text.includes('RSD'));assert(!/1 fridge|1 oven/iu.test(reply.text));}
   const duplicate=await acceptMessage(db,current,{id:requestId,text});assert.equal(duplicate.created,false);assert.equal(await db.message.count({where:{responseToMessageId:accepted.messageId}}),1);
  }
  const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert(current.leadId);
  const lead=await db.lead.findUniqueOrThrow({where:{id:current.leadId},include:{extras:{include:{extra:true}}}});
  assert.equal(Number(lead.area),88);assert.equal(Number(lead.estimatedPrice),9200);assert.equal(lead.phone,'');
  assert.deepEqual(lead.extras.map(e=>({code:e.extra.code,quantity:Number(e.quantity),unitPrice:Number(e.unitPrice)})).sort((a,b)=>a.code.localeCompare(b.code)),[{code:'fridge',quantity:1,unitPrice:1000},{code:'oven',quantity:1,unitPrice:1000}]);
  assert.equal(await db.humanHandoff.count({where:{conversationId:c.id,reason:{not:{startsWith:'SOFT:'}}}}),0);
  const asks=await db.message.count({where:{conversationId:c.id,author:'AI',text:{contains:'Нужны ли дополнительные услуги'}}});assert.equal(asks,1);
  const publicView=await publicConversation(db,current);assert(publicView.messages.every(m=>!(m.structured as Record<string,unknown>|null)?.factExtraction));
 }finally{
  const own=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert(own.externalThreadId?.startsWith('reliability-test:'));assert.equal(own.orderId,null);
  await db.$transaction(async tx=>{await tx.notification.deleteMany({where:{conversationId:c.id}});await tx.agentToolTrace.deleteMany({where:{conversationId:c.id}});await tx.aIInvocation.deleteMany({where:{conversationId:c.id}});await tx.shadowSuggestion.deleteMany({where:{conversationId:c.id}});await tx.agentSlot.deleteMany({where:{conversationId:c.id}});await tx.humanHandoff.deleteMany({where:{conversationId:c.id}});await tx.agentJob.deleteMany({where:{conversationId:c.id}});await tx.message.updateMany({where:{conversationId:c.id},data:{responseToMessageId:null}});await tx.message.deleteMany({where:{conversationId:c.id}});await tx.conversation.delete({where:{id:c.id}});if(own.leadId){await tx.leadExtra.deleteMany({where:{leadId:own.leadId}});await tx.lead.delete({where:{id:own.leadId}});}});await db.$disconnect();
 }
});
