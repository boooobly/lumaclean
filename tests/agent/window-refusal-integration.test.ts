import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {acceptMessage} from '../../src/lib/agent/inbox';
import {claimJob,drainAgentJobs} from '../../src/lib/agent/runner';
import {executeAgentTool,json,stateOf} from '../../src/lib/agent/tools';
import type {AgentState} from '../../src/lib/agent/contracts';
import type {AIProvider} from '../../src/lib/agent/providers';

const url=process.env.WINDOW_REFUSAL_TEST_DATABASE_URL;
test('window refusal persists through inbox and worker on the isolated RC database',{skip:!url},async t=>{
 assert.equal(new URL(url!).hostname.replace('-pooler.','.'),'ep-icy-smoke-b8pu84zj.c-14.us-east-1.aws.neon.tech');
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:3})});
 const baseline=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
 const previousEnabled=process.env.AI_AGENT_ENABLED;
 const ids:string[]=[];
 const orders=await db.order.count();
 const provider:AIProvider={name:'synthetic',model:'test',complete:async()=>assert.fail('A clear refusal must not need model inference')};
 const facts={service:'regular',area:60,soilLevel:'NORMAL',extrasConfirmed:true,extras:[]} as const;
 async function fixture(state:AgentState){const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'window-refusal-test:'+randomUUID(),state:json(state)}});ids.push(c.id);return c;}
 try{
  process.env.AI_AGENT_ENABLED='true';
  await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'AUTO',aiChannelModes:{...baseline.aiChannelModes as object,WEBSITE:'AUTO'}}});
  for(const text of ['Не нужно мыть мне окна','0','Ноль'])await t.test(text,async()=>{
   const c=await fixture({draftFacts:{...facts,extras:[],windowCleaning:{requested:true}},nextInput:'WINDOW_COUNTS',unresolvedInput:'WINDOW_COUNTS'});
   await acceptMessage(db,c,{id:randomUUID(),text});
   const saved=stateOf(await db.conversation.findUniqueOrThrow({where:{id:c.id}}));
   assert.equal(saved.draftFacts?.windowCleaning?.requested,false);
   assert.equal(saved.unresolvedInput,undefined);
   await drainAgentJobs(db,c.id,[provider,provider]);
   const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
   assert.equal(live.control,'AI_CONTROL');assert.equal(live.orderId,null);
   assert.equal(stateOf(live).draftFacts?.windowCleaning?.requested,false);
   const reply=await db.message.findFirstOrThrow({where:{conversationId:c.id,author:'AI'},orderBy:{sentAt:'desc'}});
   assert.doesNotMatch(reply.text,/количество окон|стандартных и больших окон/iu);
  });
  await t.test('window question requires an explicit selection in ordinary intake too',async()=>{
   const c=await fixture({draftFacts:{...facts,extras:[]}});
   await acceptMessage(db,c,{id:randomUUID(),text:'Здравствуйте'});
   const claim=await claimJob(db,c.id);assert(claim);
   const ctx={conversationId:c.id,jobId:claim.job.id,leaseKey:claim.leaseKey,revision:claim.conversation.revision,mode:claim.mode,state:stateOf(claim.conversation)};
   const result=await executeAgentTool(db,ctx,'requestCustomerInput',{intent:'WINDOW_COUNTS'});
   assert.equal(result.error,'INPUT_CONTEXT_REQUIRED');
   assert.equal(ctx.state.nextInput,undefined);
  });
  assert.equal(await db.order.count(),orders);
 }finally{
  await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:baseline.aiAgentMode,aiChannelModes:baseline.aiChannelModes!}});
  if(previousEnabled===undefined)delete process.env.AI_AGENT_ENABLED;else process.env.AI_AGENT_ENABLED=previousEnabled;
  for(const id of ids){
   const c=await db.conversation.findUniqueOrThrow({where:{id}});assert.equal(c.orderId,null);assert(c.externalThreadId?.startsWith('window-refusal-test:'));
   await db.notification.deleteMany({where:{conversationId:id}});await db.shadowSuggestion.deleteMany({where:{conversationId:id}});await db.agentSlot.deleteMany({where:{conversationId:id}});await db.agentToolTrace.deleteMany({where:{conversationId:id}});await db.aIInvocation.deleteMany({where:{conversationId:id}});await db.humanHandoff.deleteMany({where:{conversationId:id}});await db.agentJob.deleteMany({where:{conversationId:id}});await db.message.deleteMany({where:{conversationId:id}});
   await db.conversation.update({where:{id},data:{leadId:null}});if(c.leadId){await db.leadExtra.deleteMany({where:{leadId:c.leadId}});await db.lead.delete({where:{id:c.leadId}});}await db.conversation.delete({where:{id}});
  }
  await db.$disconnect();
 }
});
