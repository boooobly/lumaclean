import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {acceptMessage,runInboxCommand} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
import {executeAgentTool,json,type ToolContext} from '../../src/lib/agent/tools';
import type {AgentState} from '../../src/lib/agent/contracts';
import {appliancePrices} from '../../src/lib/appliance-catalog';
import type {AIProvider} from '../../src/lib/agent/providers';
const url=process.env.RELIABILITY_TEST_DATABASE_URL;
test('source proposals, partial-list blocking and CRM safety through actual Preview tools',{skip:!url},async t=>{
 assert(new URL(url!).hostname.startsWith('ep-wispy-river-b8xwqy9q'));process.env.AI_AGENT_ENABLED='true';
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:3})}),owned:string[]=[];
 async function fixture(state:AgentState,text:string){
  const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'reliability-test:'+randomUUID(),state:json(state)}});owned.push(c.id);
  const m=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text}}),leaseKey=randomUUID();
  const job=await db.agentJob.create({data:{conversationId:c.id,messageId:m.id,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+180000)}});
  const ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:0,mode:'AUTO',state};return{c,ctx};
 }
 try{
  await t.test('natural semantics are proposed and cannot quote before customer confirms',async()=>{
   const text='Хочу лёгкое еженедельное наведение порядка',f=await fixture({draftFacts:{area:88,soilLevel:'NORMAL',extrasConfirmed:true,extras:[]}},text);
   const result=await executeAgentTool(db,f.ctx,'recordCustomerFacts',{facts:{service:'regular'},evidence:text,fieldEvidence:[{field:'service',evidence:text}]});assert.equal(result.needsCustomerConfirmation,true);assert.equal(f.ctx.state.draftFacts?.service,undefined);assert.equal(f.ctx.state.pendingFactProposal?.facts.service,'regular');
   const price=await executeAgentTool(db,f.ctx,'calculatePrice',{service:'regular',area:88,soilLevel:'NORMAL',extras:[],urgent:false});assert.equal(price.error,'FACT_CONFIRMATION_REQUIRED');
   assert.equal((await db.conversation.findUniqueOrThrow({where:{id:f.c.id}})).control,'AI_CONTROL');assert.equal(await db.humanHandoff.count({where:{conversationId:f.c.id}}),0);
  });
  await t.test('same excerpt from an unrelated turn is not provenance',async()=>{
   const f=await fixture({},'Нужна консультация');const result=await executeAgentTool(db,f.ctx,'recordCustomerFacts',{facts:{area:88},evidence:'88',fieldEvidence:[{field:'area',evidence:'88'}]});assert.equal(result.error,'CUSTOMER_FACTS_REQUIRED');assert.equal(f.ctx.state.draftFacts?.area,undefined);
  });
  await t.test('Lead tool cannot overwrite confirmed operational facts',async()=>{
   const f=await fixture({draftFacts:{service:'regular',area:88}},'Уборка 88 м²');const result=await executeAgentTool(db,f.ctx,'createOrUpdateLead',{intent:'cleaning',service:'deep',area:1});assert.equal(result.error,'CUSTOMER_FACTS_REQUIRED');assert.equal((await db.conversation.findUniqueOrThrow({where:{id:f.c.id}})).leadId,null);
  });
  await t.test('Lead rejects an invented contact name',async()=>{const f=await fixture({},'Здравствуйте');const result=await executeAgentTool(db,f.ctx,'createOrUpdateLead',{intent:'cleaning',name:'Mila'});assert.equal(result.error,'CUSTOMER_FACTS_REQUIRED');});
  await t.test('catalog has six active per-unit items at approved prices',async()=>{const rows=await db.serviceExtra.findMany({where:{code:{in:['fridge','oven','microwave','hood','dishwasher','washingMachine']}}});assert.equal(rows.length,6);assert(rows.every(e=>e.active&&Number(e.unitPrice)===appliancePrices[e.code as keyof typeof appliancePrices]&&e.unit==='item'));});
  await t.test('calculator zero placeholders cannot pollute confirmed selected extras',async()=>{
   const f=await fixture({draftFacts:{service:'regular',area:88,soilLevel:'NORMAL',extras:[{code:'fridge',quantity:1}],extrasConfirmed:true}},'Сколько стоит?');
   const result=await executeAgentTool(db,f.ctx,'calculatePrice',{service:'regular',area:88,soilLevel:'NORMAL',urgent:false,extras:[{code:'fridge',quantity:1},{code:'oven',quantity:0},{code:'hood',quantity:0}]});assert.equal(result.total,10800);assert.deepEqual(f.ctx.state.draftFacts?.extras,[{code:'fridge',quantity:1}]);assert.deepEqual(f.ctx.state.quote?.input.extras,[{code:'fridge',quantity:1}]);
  });
  await t.test('hypothetical appliance exclusion uses the server calculator without changing the draft',async()=>{
   const f=await fixture({draftFacts:{service:'regular',area:88,soilLevel:'NORMAL',extras:[{code:'fridge',quantity:1},{code:'oven',quantity:1}],extrasConfirmed:true}},'А без холодильника?');
   await executeAgentTool(db,f.ctx,'calculatePrice',{service:'regular',area:88,soilLevel:'NORMAL',urgent:false,extras:[{code:'fridge',quantity:1},{code:'oven',quantity:1}]});
   const before=structuredClone(f.ctx.state);const result=await executeAgentTool(db,f.ctx,'calculateAlternativePrice',{exclude:['fridge'],evidence:'А без холодильника?'});assert.equal((result.quote as AgentState['quote'])?.total,11200);assert.deepEqual(f.ctx.state,before);assert.equal(f.ctx.state.quote?.total,12200);
  });
  await t.test('human reconciliation cannot apply an already persisted additional quantity twice',async()=>{
   const f=await fixture({draftFacts:{service:'regular',area:88,soilLevel:'NORMAL',extras:[{code:'fridge',quantity:1}],extrasConfirmed:true}},'Исходные детали');
   const owner=await db.user.findFirstOrThrow({where:{active:true,role:'ADMIN'}});
   await runInboxCommand(db,owner.id,{action:'takeover',id:f.c.id});await runInboxCommand(db,owner.id,{action:'reply',id:f.c.id,text:'Уточню площадь: 80 м²',requestId:randomUUID()});
   const operator=await db.message.findFirstOrThrow({where:{conversationId:f.c.id,author:'ADMIN'},orderBy:{sentAt:'desc'}});
   await acceptMessage(db,await db.conversation.findUniqueOrThrow({where:{id:f.c.id}}),{id:randomUUID(),text:'Добавьте ещё один холодильник изнутри'});
   await runInboxCommand(db,owner.id,{action:'resume',id:f.c.id});await acceptMessage(db,await db.conversation.findUniqueOrThrow({where:{id:f.c.id}}),{id:randomUUID(),text:'Продолжим'});
   const claim=await claimJob(db,f.c.id);assert(claim);const ctx:ToolContext={conversationId:f.c.id,jobId:claim.job.id,leaseKey:claim.leaseKey,revision:claim.conversation.revision,mode:'AUTO',state:claim.conversation.state as AgentState};
   const result=await executeAgentTool(db,ctx,'reconcileHumanContext',{reviewedMessageIds:[operator.id],corrections:[{messageId:operator.id,facts:{area:80},evidence:'80 м²'}]});assert(!result.error);assert.equal(ctx.state.draftFacts?.area,80);assert.deepEqual(ctx.state.draftFacts?.extras,[{code:'fridge',quantity:2}]);
  });
  await t.test('partial extraction must not silently price only one of two requested items',async()=>{
   const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'reliability-test:'+randomUUID(),state:json({draftFacts:{service:'regular',area:88,soilLevel:'NORMAL'},nextInput:'EXTRAS'})}});owned.push(c.id);
   const text='Холодильник и уберите внутри всех закрытых шкафов';await acceptMessage(db,c,{id:randomUUID(),text});const claim=await claimJob(db,c.id);assert(claim);
   const provider:AIProvider={name:'fixture',model:'fixture',complete:async()=>({text:'',toolCalls:[{id:randomUUID(),name:'recordCustomerFacts',arguments:JSON.stringify({facts:{extras:[{code:'fridge',quantity:1}],extrasConfirmed:true},evidence:text})}],provider:'fixture',model:'fixture',inputTokens:1,cachedInputTokens:0,outputTokens:1,latencyMs:1,estimatedCostUsd:0})};
   await runClaimedJob(db,claim,[provider,provider]);const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=current.state as AgentState;
   assert.equal(state.unresolvedInput,'EXTRAS');assert.equal(state.quote,undefined);assert.equal(current.orderId,null);assert.equal(current.control,'AI_CONTROL');assert.equal(state.reliability?.factExtractionFailure,1);
   const reply=await db.message.findUniqueOrThrow({where:{responseToMessageId:claim.job.messageId}});assert(reply.text.includes('конкретные'));assert(!reply.text.includes('Нужны ли дополнительные услуги'));
  });
 }finally{
  for(const id of owned){const c=await db.conversation.findUniqueOrThrow({where:{id}});assert(c.externalThreadId?.startsWith('reliability-test:'));assert.equal(c.orderId,null);await db.$transaction(async tx=>{const scope={conversationId:id};await tx.notification.deleteMany({where:scope});await tx.agentToolTrace.deleteMany({where:scope});await tx.aIInvocation.deleteMany({where:scope});await tx.humanHandoff.deleteMany({where:scope});await tx.agentJob.deleteMany({where:scope});await tx.message.updateMany({where:scope,data:{responseToMessageId:null}});await tx.message.deleteMany({where:scope});await tx.conversation.delete({where:{id}});if(c.leadId){await tx.leadExtra.deleteMany({where:{leadId:c.leadId}});await tx.lead.delete({where:{id:c.leadId}});}});}
  await db.$disconnect();
 }
});
