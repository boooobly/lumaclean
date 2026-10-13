import {randomUUID} from 'node:crypto';
import type {PrismaClient} from '@/generated/prisma/client';
import {AgentError,type AgentState} from './contracts';
import {autonomyCorpus} from './autonomy-corpus';
import {configuredProviders} from './providers';
import {previewTestAllowed} from './live-proof';
import {acceptMessage} from './inbox';
import {claimJob,runClaimedJob} from './runner';
import {effectiveMode} from './readiness';
/** Admin-only, isolated Preview, real native tools/state. Never a production customer. */
export async function autonomyPreview(db:PrismaClient,scenarioId:string,providerIndex:'primary'|'fallback'){
 if(!previewTestAllowed()||!new URL(process.env.DATABASE_URL!).hostname.startsWith('ep-wispy-river-b8xwqy9q'))throw new AgentError('ISOLATED_PREVIEW_REQUIRED');
 const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
 if(effectiveMode(settings,'WEBSITE')!=='AUTO')throw new AgentError('PREVIEW_WEBSITE_AUTO_REQUIRED');
 const s=autonomyCorpus.find(s=>s.id===scenarioId);if(!s)throw new AgentError('SCENARIO_NOT_FOUND');
 // Event injection/burst/photo/actual calendar fixtures have a separate domain suite.
 if(s.event)throw new AgentError('DOMAIN_EVENT_SUITE_REQUIRED');
 const providers=configuredProviders(),selected=providerIndex==='primary'?providers:[providers[1],providers[0]] as typeof providers;
 const c=await db.conversation.create({data:{channel:'WEBSITE',locale:s.locale,externalThreadId:'autonomy-test:'+randomUUID(),displayAlias:'Mila'}});
 let report:Record<string,unknown>;
 try{
  await acceptMessage(db,c,{id:randomUUID(),text:s.text});const claim=await claimJob(db,c.id);if(!claim)throw new AgentError('JOB_NOT_CLAIMED');
  await runClaimedJob(db,claim,selected);
  const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=live.state as AgentState;
  const [messages,handoffs,tools,invocations]=await Promise.all([db.message.findMany({where:{conversationId:c.id,author:'AI'},select:{text:true,structured:true}}),db.humanHandoff.findMany({where:{conversationId:c.id},select:{reason:true}}),db.agentToolTrace.findMany({where:{conversationId:c.id},select:{tool:true,outcome:true}}),db.aIInvocation.findMany({where:{conversationId:c.id},select:{provider:true,success:true,errorCode:true},orderBy:{createdAt:'asc'}})]);
  const response=messages.at(-1),hard=handoffs.some(h=>!h.reason.startsWith('SOFT:')),soft=handoffs.some(h=>h.reason.startsWith('SOFT:'));
  const recovery=(response?.structured as {autonomy?:{recovery?:boolean}}|null)?.autonomy?.recovery===true;
  const outcome=hard?'HARD_HANDOFF':soft?'SOFT_REVIEW':'AI_HANDLES';
  const nativeUsed=invocations.some(i=>i.provider===selected[0].name&&i.success);
  const nativeComplete=nativeUsed&&invocations.filter(i=>i.success).every(i=>i.provider===selected[0].name);
  const inconclusive=invocations.length>0&&!nativeComplete;
  const factsPreserved=!s.facts||Object.entries(s.facts).every(([key,v])=>state.draftFacts?.[key as keyof NonNullable<AgentState['draftFacts']>]===v);
  const faq=s.category.includes('faq')||['public-price','service-difference','windows','appliance','upholstery-price','language-switch'].includes(s.category);
  const grounded=!faq||tools.some(t=>t.tool==='getBusinessInfo'&&t.outcome==='OK');
  report={id:s.id,provider:selected[0].name,expected:s.expected,outcome,status:inconclusive?'INCONCLUSIVE':outcome===s.expected&&factsPreserved&&grounded&&!recovery&&!!response?(nativeComplete?'PASS':'DOMAIN_PASS'):'FAIL',nativeUsed,nativeComplete,factsPreserved,grounded,recovery,hasLead:!!live.leadId,bookingBlocked:!!state.upholsteryInquiry||!!state.review?.reasons.length,control:live.control,handoffs,tools,invocations,response:response?.text??null};
 }finally{
  const own=await db.conversation.findUniqueOrThrow({where:{id:c.id}});if(!own.externalThreadId?.startsWith('autonomy-test:')||own.orderId)throw new AgentError('PREVIEW_CLEANUP_REVIEW_REQUIRED');
  await db.$transaction(async tx=>{
   await tx.notification.deleteMany({where:{conversationId:c.id}});await tx.agentToolTrace.deleteMany({where:{conversationId:c.id}});await tx.aIInvocation.deleteMany({where:{conversationId:c.id}});await tx.shadowSuggestion.deleteMany({where:{conversationId:c.id}});await tx.agentSlot.deleteMany({where:{conversationId:c.id}});await tx.humanHandoff.deleteMany({where:{conversationId:c.id}});await tx.agentJob.deleteMany({where:{conversationId:c.id}});
   await tx.message.updateMany({where:{conversationId:c.id},data:{responseToMessageId:null}});await tx.message.deleteMany({where:{conversationId:c.id}});await tx.conversation.delete({where:{id:c.id}});
   if(own.leadId)await tx.lead.delete({where:{id:own.leadId}});
  });
 }
 return {...report!,cleaned:true};
}
