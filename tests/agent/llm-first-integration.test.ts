import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {acceptMessage,publicConversation} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
import type {AIProvider,Completion} from '../../src/lib/agent/providers';
import type {AgentState,ToolName} from '../../src/lib/agent/contracts';
const url=process.env.LLM_FIRST_TEST_DATABASE_URL;
test('LLM_FIRST interprets natural multi-fact ingress and composes a validated native question in one call',{skip:!url},async()=>{
 assert(new URL(url!).hostname.startsWith('ep-wispy-river-b8xwqy9q'));
 process.env.AI_AGENT_ENABLED='true';
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:3})});
 const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'llm-first-test:'+randomUUID()}});
 let calls=0;
 const response=(text:string,name?:ToolName,args?:unknown):Completion=>({text,toolCalls:name?[{id:randomUUID(),name,arguments:JSON.stringify(args)}]:[],provider:'fixture',model:'fixture',inputTokens:1,cachedInputTokens:0,outputTokens:1,latencyMs:1,estimatedCostUsd:0});
 const provider:AIProvider={name:'fixture',model:'fixture',complete:async messages=>{
  calls++;assert(messages[0].content.includes('CONVERSATION STRATEGY: LLM_FIRST'));
  if(messages.findLast(m=>m.role==='user')?.content.includes('88'))return response('Для расчёта уточните, загрязнение обычное или сильное?','requestCustomerInput',{intent:'SOIL_LEVEL'});
  if(messages.at(-1)?.role==='tool')return response('Предварительная стоимость — 9 200 RSD: уборка 7 200 RSD, холодильник 1 000 RSD и духовка 1 000 RSD. На какую дату планируете уборку?');
  return response('','calculatePrice',{service:'regular',area:88,soilLevel:'NORMAL',extras:[{code:'fridge',quantity:1},{code:'oven',quantity:1}],urgent:false});
 }};
 try{
  for(const [index,text] of ['Мне нужна обычная уборка 88 квадратов. И духовку с холодильником изнутри. Сколько стоит?','Обычное загрязнение'].entries()){
   const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),accepted=await acceptMessage(db,live,{id:randomUUID(),text});const claim=await claimJob(db,c.id);assert(claim);
   await runClaimedJob(db,claim,[provider,provider],undefined,undefined,{strategy:'LLM_FIRST'});
   const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=current.state as AgentState;
   assert.equal(current.control,'AI_CONTROL');assert.equal(current.orderId,null);assert.equal(state.lastDecision?.strategy,'LLM_FIRST');
   assert.equal(await db.message.count({where:{responseToMessageId:accepted.messageId}}),1);
   if(index===0){assert.equal(calls,1);assert.equal(state.nextInput,'SOIL_LEVEL');assert.equal(state.questionContext?.questionKey,'SOIL_LEVEL');assert.equal(state.lastDecision?.answerOrigin,'LLM-generated');}
   else{assert.equal(calls,3);assert.equal(state.quote?.total,9200);assert.equal(state.lastDecision?.answerOrigin,'deterministic quote + LLM response');}
   const visible=await publicConversation(db,current);assert(!JSON.stringify(visible).includes('answerOrigin'));assert(!JSON.stringify(visible).includes('quickReplyConfirmed'));
  }
 }finally{
  const own=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert(!own.orderId&&!own.clientId);
  await db.$transaction(async tx=>{
   const scope={conversationId:c.id};await tx.notification.deleteMany({where:scope});await tx.agentToolTrace.deleteMany({where:scope});await tx.aIInvocation.deleteMany({where:scope});await tx.agentSlot.deleteMany({where:scope});await tx.humanHandoff.deleteMany({where:scope});await tx.agentJob.deleteMany({where:scope});await tx.message.updateMany({where:scope,data:{responseToMessageId:null}});await tx.message.deleteMany({where:scope});await tx.conversation.delete({where:{id:c.id}});if(own.leadId){await tx.leadExtra.deleteMany({where:{leadId:own.leadId}});await tx.lead.delete({where:{id:own.leadId}});}
  },{timeout:30000});await db.$disconnect();
 }
});
