import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {pgConnectionString} from '../../src/lib/database/connection';
import {executeAgentTool,json,type ToolContext} from '../../src/lib/agent/tools';
import type {AgentState} from '../../src/lib/agent/contracts';
import {bookingReviewBlocked} from '../../src/lib/agent/conversion-facts';
const url=process.env.KNOWLEDGE_TEST_DATABASE_URL;
test('actual knowledge tools, Lead persistence and booking boundaries on the disposable branch',{skip:!url},async t=>{
 assert.equal(new URL(url!).hostname.split('.')[0].replace('-pooler',''),'ep-red-field-b8bc6tfu');
 process.env.AI_AGENT_ENABLED='true';
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:2})}),owned:string[]=[];
 const beforeOrders=await db.order.count(),beforeModes=(await db.businessSettings.findUniqueOrThrow({where:{id:'default'}})).aiChannelModes;
 async function context(text:string,state:AgentState={}){
  const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'knowledge-tools:'+randomUUID(),state:json(state)}});owned.push(c.id);
  const m=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text}}),leaseKey=randomUUID();
  const job=await db.agentJob.create({data:{conversationId:c.id,messageId:m.id,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+300000)}});
  return{conversationId:c.id,jobId:job.id,leaseKey,revision:0,mode:'AUTO',state} as ToolContext;
 }
 try{
  for(const [code,amount] of [['ADD-KITCHEN-001',1000],['ADD-KITCHEN-004',1400],['ADD-KITCHEN-005',700],['ADD-BATH-001',1200],['ADD-BATH-002',2500],['UPH-SOFA-002',4600],['UPH-MATTRESS-002',2000],['UPH-CARPET-001',450]] as const)await t.test('verified live retrieval '+code,async()=>{
   const ctx=await context('Сколько стоит?'),result=await executeAgentTool(db,ctx,'searchBusinessKnowledge',{query:code});
   assert.equal(result.error,undefined);const match=(result.matches as {code:string;price:{amount:number}}[]).find(e=>e.code===code);assert.equal(match?.price.amount,amount);
   assert.equal((await db.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}})).leadId,null);
  });
  await t.test('knowledge capabilities respect existing runtime service scope without changing settings',async()=>{
   const ctx=await context('Что входит в офисную уборку?'),result=await executeAgentTool(db,ctx,'searchBusinessKnowledge',{query:'PACKAGE-OFFICE'});
   const entry=(result.matches as {code:string;autoCalculate:boolean;autoBook:boolean;managerReview:boolean}[]).find(e=>e.code==='PACKAGE-OFFICE')!;
   const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}}),enabled=settings.aiAllowedServices.includes('office');
   assert.equal(entry.autoCalculate,enabled);assert.equal(entry.autoBook,enabled);assert.equal(entry.managerReview,!enabled);
  });
  await t.test('minimum-visit follow-up rehydrates the discussed item from current catalog, not cached numbers',async()=>{
   const ctx=await context('Сколько стоит трёхместный диван?');
   await executeAgentTool(db,ctx,'searchBusinessKnowledge',{query:'UPH-SOFA-002'});
   const result=await executeAgentTool(db,ctx,'searchBusinessKnowledge',{query:'Как работает минимальный выезд?'});
   assert((result.matches as {code:string}[]).some(e=>e.code==='UPH-SOFA-002'));assert(ctx.factAmounts?.includes(4600));
   assert(ctx.state.knowledgeContext?.version);assert(!JSON.stringify(ctx.state.knowledgeContext).includes('4600'));
  });
  await t.test('consultation admission also rejects unadvertised terminal tools on the server',async()=>{
   const ctx=await context('Что входит в генеральную уборку?');ctx.allowedTools=['searchBusinessKnowledge','getBusinessInfo'];
   const result=await executeAgentTool(db,ctx,'requestCustomerInput',{intent:'AREA'});
   assert.equal(result.error,'ANSWER_DIRECT_QUESTION_FIRST');assert.equal(ctx.responseText,undefined);assert.equal(ctx.state.nextInput,undefined);
  });
  await t.test('unsupported extra request is saved once, remains AI_CONTROL and cannot be booked',async()=>{
   const evidence='Хочу помыть ролеты на всех окнах',ctx=await context(evidence);
   for(let i=0;i<2;i++)assert.equal((await executeAgentTool(db,ctx,'recordKnowledgeRequest',{codes:['ADD-WINDOW-017'],evidence,action:'ADD'})).saved,true);
   const c=await db.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}}),lead=await db.lead.findUniqueOrThrow({where:{id:c.leadId!}});
   assert.equal(c.control,'AI_CONTROL');assert.equal(ctx.state.knowledgeRequests?.length,1);assert.match(lead.internalNote??'',/ADD-WINDOW-017/);assert(lead.humanReviewRequired);assert(bookingReviewBlocked(ctx.state));
   assert((await executeAgentTool(db,ctx,'createOrder',{})).error);assert.equal(await db.lead.count({where:{submissionId:`agent:${c.id}`}}),1);
  });
  await t.test('FAQ and unavailable work cannot create a catalog request',async()=>{
   const evidence='Da li perete roletne?',ctx=await context(evidence);
   assert.equal((await executeAgentTool(db,ctx,'recordKnowledgeRequest',{codes:['ADD-WINDOW-017'],evidence,action:'ADD'})).error,'FACT_EVIDENCE_REJECTED');
   assert.equal((await db.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}})).leadId,null);
  });
  await t.test('second bathroom returns only known subtotal and blocks a final quote',async()=>{
   const input={service:'regular' as const,area:75,soilLevel:'NORMAL' as const,extras:[],urgent:false},ctx=await context('Два санузла, поддерживающая 75 м²',{draftFacts:{...input,extrasConfirmed:true,bathroomCount:2}});
   const result=await executeAgentTool(db,ctx,'calculatePrice',input);assert.equal(result.total,8200);assert.equal(result.final,false);assert.equal(result.requiresHumanReview,true);assert((result.pendingReviewItems as string[]).includes('ADDITIONAL_BATHROOM'));assert(bookingReviewBlocked(ctx.state));
  });
  await t.test('upholstery-only intention immediately creates a Lead, never an Order',async()=>{
   const evidence='Нужно только диван почистить. Трёхместный.',ctx=await context(evidence);
   assert.equal((await executeAgentTool(db,ctx,'markUpholsteryInquiry',{evidence})).autonomousBooking,false);
   const c=await db.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}}),lead=await db.lead.findUniqueOrThrow({where:{id:c.leadId!}});assert(lead.upholsteryRequested);assert(lead.humanReviewRequired);assert.equal(c.control,'AI_CONTROL');
   assert.equal((await executeAgentTool(db,ctx,'findAvailableSlots',{date:'2026-10-25',from:'2026-10-25T10:00',to:'2026-10-25T15:00'})).error,'UPHOLSTERY_REVIEW_REQUIRED');
  });
  assert.equal(await db.order.count(),beforeOrders);assert.deepEqual((await db.businessSettings.findUniqueOrThrow({where:{id:'default'}})).aiChannelModes,beforeModes);
 }finally{
  for(const id of owned)await db.$transaction(async tx=>{
   const c=await tx.conversation.findUniqueOrThrow({where:{id}});assert(c.externalThreadId?.startsWith('knowledge-tools:'));assert.equal(c.orderId,null);
   await tx.notification.deleteMany({where:{conversationId:id}});await tx.agentToolTrace.deleteMany({where:{conversationId:id}});await tx.humanHandoff.deleteMany({where:{conversationId:id}});await tx.agentJob.deleteMany({where:{conversationId:id}});await tx.message.deleteMany({where:{conversationId:id}});await tx.conversation.delete({where:{id}});
   if(c.leadId){await tx.leadExtra.deleteMany({where:{leadId:c.leadId}});await tx.lead.delete({where:{id:c.leadId}});}
  });await db.$disconnect();
 }
});
