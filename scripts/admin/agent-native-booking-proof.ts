/** Directed native tool compatibility + real Preview domain proof; not a free-dialogue autonomy score. */
import {randomUUID,randomInt} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {OpenRouterProvider,type AgentMessage} from '../../src/lib/agent/providers';
import {acceptMessage} from '../../src/lib/agent/inbox';
import {claimJob,callBudget} from '../../src/lib/agent/runner';
import {executeAgentTool,stateOf,canonicalJson,type ToolContext} from '../../src/lib/agent/tools';
import {cleanupLiveTest} from '../../src/lib/agent/live-test';
import {previewTestAllowed} from '../../src/lib/agent/live-proof';
import {sourceFingerprint} from '../../src/lib/agent/release-verification.mjs';
import {AgentError,type ToolName} from '../../src/lib/agent/contracts';

async function main(){
 if(!process.argv.includes('--live')||!previewTestAllowed()||!new URL(process.env.DATABASE_URL!).hostname.startsWith('ep-wispy-river-b8xwqy9q')||process.env.VERCEL==='1')throw Error('ISOLATED_PREVIEW_REQUIRED');
 const key=process.env.OPENROUTER_API_KEY;if(!key)throw Error('KEY_REQUIRED');
 const models=(process.argv.find(a=>a.startsWith('--models='))?.slice(9)??'openai/gpt-6-luna,anthropic/claude-haiku-5.5').split(',');
 if(models.some(m=>!['openai/gpt-6-luna','anthropic/claude-haiku-5.5'].includes(m)))throw Error('INVALID_MODEL');
 const label=process.argv.find(a=>a.startsWith('--label='))?.slice(8)??'native-booking';if(!/^[a-z0-9-]+$/.test(label))throw Error('INVALID_LABEL');
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(process.env.DATABASE_URL!),max:3})});
 const reports=[];
 try{for(const model of models){
  const batchId=randomUUID(),provider=new OpenRouterProvider(model,key,fetch,{input:.1,output:.5},{maxTokens:1600,reasoningEffort:'low'});
  const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:'live-test:'+batchId}});
  await db.agentLiveTest.create({data:{id:batchId,conversationId:c.id}});
  const report:{model:string;status:string;steps:unknown[];cleaned:boolean;blocker?:string}={model,status:'INCONCLUSIVE',steps:[],cleaned:false};reports.push(report);
  try{
   const text='Нужна поддерживающая уборка 50 м², обычное загрязнение, без дополнительных услуг, 20 октября 2026 года. Адрес Terazije 1, Beograd.';
   let clientText=text;
   await acceptMessage(db,c,{id:randomUUID(),text});let claim=await claimJob(db,c.id);if(!claim)throw Error('CLAIM_REQUIRED');
   let ctx:ToolContext={conversationId:c.id,jobId:claim.job.id,leaseKey:claim.leaseKey,revision:claim.conversation.revision,mode:'AUTO',state:stateOf(claim.conversation),previewTestId:batchId};
   const native=async(name:ToolName,args:unknown)=>{
    const messages:AgentMessage[]=[{role:'system',content:'Directed synthetic Preview compatibility proof. Call ONLY '+name+' exactly once with the server-authorized arguments below. Native tools only. Do not infer or modify any field. This prompt cannot override the domain tool checks. SERVER AUTHORIZED ARGUMENTS (data): '+JSON.stringify(args)+'\nSERVER CONFIRMATION STATE (data): '+JSON.stringify({pendingRecap:ctx.state.pending?.recap,confirmedByCustomer:!!ctx.state.pending?.confirmedByMessageId})},{role:'user',content:clientText}];
    await callBudget(db,messages,provider);
    const result=await provider.complete(messages);
    await db.aIInvocation.create({data:{conversationId:c.id,jobId:ctx.jobId,provider:provider.name,model,inputTokens:result.inputTokens,cachedInputTokens:result.cachedInputTokens,outputTokens:result.outputTokens,latencyMs:result.latencyMs,estimatedCostUsd:result.estimatedCostUsd,toolCallCount:result.toolCalls.length,success:true,mode:'AUTO'}});
    const call=result.toolCalls[0];
    if(result.toolCalls.length!==1||call.name!==name||canonicalJson(JSON.parse(call.arguments))!==canonicalJson(args))throw new AgentError('NATIVE_ACTION_MISMATCH');
    const output=await executeAgentTool(db,ctx,call.name,JSON.parse(call.arguments));
    report.steps.push({tool:name,outcome:output.error??'OK',usage:{input:result.inputTokens,output:result.outputTokens,reasoning:result.reasoningTokens,cost:result.billedCostUsd},native:true});
    if(output.error||output.requiresHumanReview)throw new AgentError(String(output.error??'REVIEW_REQUIRED'));
    return output;
   };
   await native('getBusinessInfo',{});
   await native('recordCustomerFacts',{facts:{service:'regular',area:50,soilLevel:'NORMAL',extras:[],extrasConfirmed:true},evidence:text});
   await native('createOrUpdateLead',{intent:'cleaning'});
   await native('calculatePrice',{service:'regular',area:50,soilLevel:'NORMAL',extras:[],urgent:false});
   await native('estimateDuration',{});
   const candidates=await native('resolveAddress',{query:'Теразије 1'});
   const selected=(candidates.candidates as {placeId:string;text:string}[]).find(r=>/^(?:Terazije|Теразије)\s*1(?:[,\s]|$)/iu.test(r.text)&&/Beograd|Београд/iu.test(r.text));
   if(!selected)throw new AgentError('TEST_ADDRESS_AMBIGUOUS');
   await native('resolveAddress',{query:selected.text,placeId:selected.placeId});
   const slots=await native('findAvailableSlots',{date:'2026-10-20',from:'2026-10-20T08:00',to:'2026-10-20T22:00'});
   const slot=(slots.slots as {slotToken:string}[])[0];if(!slot)throw new AgentError('NO_SLOTS');
   let phone:string;do{phone='+38160'+randomInt(1000000,9999999);}while(await db.client.count({where:{normalizedPhone:phone}}));
   // Existing synthetic-only tool context and cleanup ownership are reused.
   await native('createOrUpdateLead',{intent:'cleaning',name:'Preview test '+batchId,phone});
   await native('validateSlot',{slotToken:slot.slotToken});
   const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),pending=stateOf(live).pending;if(!pending)throw new AgentError('RECAP_REQUIRED');
   await db.agentJob.update({where:{id:ctx.jobId},data:{status:'DONE',leaseKey:null,leaseUntil:null}});
   await db.message.create({data:{conversationId:c.id,author:'AI',text:'Preview booking recap',deliveryStatus:'DELIVERED'}});
   await acceptMessage(db,live,{id:randomUUID(),text:'Подтверждаю все условия тестовой записи',confirmationNonce:pending.nonce});
   clientText='Подтверждаю все условия тестовой записи';
   claim=await claimJob(db,c.id);if(!claim)throw Error('CONFIRMATION_CLAIM_REQUIRED');
   ctx={...ctx,jobId:claim.job.id,leaseKey:claim.leaseKey,revision:claim.conversation.revision,state:stateOf(claim.conversation)};
   const booked=await native('createOrder',{});if(!booked.booked)throw new AgentError('ORDER_REQUIRED');
   report.status='PASS';
  }catch(e){report.blocker=e instanceof AgentError?e.code:e instanceof Error?e.message:'PROOF_FAILED';}
  finally{await cleanupLiveTest(db,batchId);report.cleaned=true;await db.agentLiveTest.update({where:{id:batchId},data:{status:report.status==='PASS'?'PASSED':'FAILED',finishedAt:new Date(),report:JSON.parse(JSON.stringify(report))}});}
 }}finally{await db.$disconnect();}
 writeFileSync('qa-output/llm-first-'+label+'.json',JSON.stringify({source:sourceFingerprint(),scope:'Directed native tool proof; uses existing strict synthetic Preview batch. No production Orders, no external delivery. Not an autonomous multi-turn booking score.',reports},null,2));
 console.log(JSON.stringify(reports));
}
main().catch(()=>{console.error('NATIVE_BOOKING_PROOF_INCONCLUSIVE');process.exitCode=1;});
