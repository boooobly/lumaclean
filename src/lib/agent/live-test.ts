import {randomUUID,randomInt} from 'node:crypto';
import type {PrismaClient} from '@/generated/prisma/client';
import {AgentError,qualificationSchema,type ToolResult} from './contracts';
import {configuredProviders} from './providers';
import {completeWithFallback} from './runner';
import {readiness} from './readiness';
import {canonicalJson,executeAgentTool,json,stateOf,type ToolContext} from './tools';
import {acceptMessage} from './inbox';
import {liveConfigFingerprint,previewTestAllowed,signLiveProof} from './live-proof';
import {normalizedPhone} from '@/lib/domain/crm';
import {writeAudit} from '@/lib/services/audit';

export const liveTestSteps=['AI понял запрос','Цена рассчитана','Duration рассчитан','Адрес найден','Маршрут рассчитан','Свободный слот найден','Повторная проверка слота','Order создан'] as const;
export type LiveTestReport={status:'PASSED'|'FAILED';steps:{label:string;ok:boolean}[];blocker:string|null;cleaned:boolean;aiAttempts?:{provider:string;model:string;ok:boolean;errorCode:string|null;latencyMs:number}[];proof?:ReturnType<typeof signLiveProof>};
export async function cleanupLiveTest(db:PrismaClient,batchId:string){
  if(!previewTestAllowed())throw new AgentError('PREVIEW_TEST_ONLY');
  await db.$transaction(async tx=>{
    const batch=await tx.agentLiveTest.findUniqueOrThrow({where:{id:batchId}});
    if(!batch.conversationId)return;
    const c=await tx.conversation.findUnique({where:{id:batch.conversationId}});
    if(!c)return;
    if(c.externalThreadId!==`live-test:${batchId}`||c.channel!=='WEBSITE'||c.anonymousHash)throw new AgentError('LIVE_TEST_CLEANUP_UNSAFE');
    const slots=await tx.agentSlot.findMany({where:{conversationId:c.id},select:{id:true}});
    if(c.clientId){const client=await tx.client.findUniqueOrThrow({where:{id:c.clientId}});if(client.name!==`Preview test ${batchId}`||await tx.order.count({where:{clientId:c.clientId,id:{not:c.orderId??''}}})||await tx.conversation.count({where:{clientId:c.clientId,id:{not:c.id}}}))throw new AgentError('LIVE_TEST_CLEANUP_UNSAFE');}
    if(c.orderId){const order=await tx.order.findUniqueOrThrow({where:{id:c.orderId}});if(!slots.some(s=>order.requestId===`agent:${s.id}`)||order.clientId!==c.clientId)throw new AgentError('LIVE_TEST_CLEANUP_UNSAFE');}
    await tx.conversation.update({where:{id:c.id},data:{orderId:null,clientId:null,leadId:null,control:'CLOSED'}});
    await tx.notification.deleteMany({where:{conversationId:c.id}});
    if(c.orderId){await tx.orderCleaner.deleteMany({where:{orderId:c.orderId}});await tx.orderExtra.deleteMany({where:{orderId:c.orderId}});await tx.order.delete({where:{id:c.orderId}});}
    if(c.clientId){await tx.clientAddress.deleteMany({where:{clientId:c.clientId}});await tx.client.delete({where:{id:c.clientId}});}
    if(c.leadId){const lead=await tx.lead.findUniqueOrThrow({where:{id:c.leadId}});if(lead.submissionId!==`agent:${c.id}`)throw new AgentError('LIVE_TEST_CLEANUP_UNSAFE');await tx.lead.delete({where:{id:c.leadId}});}
    await tx.agentSlot.deleteMany({where:{conversationId:c.id}});await tx.agentToolTrace.deleteMany({where:{conversationId:c.id}});await tx.aIInvocation.deleteMany({where:{conversationId:c.id}});await tx.shadowSuggestion.deleteMany({where:{conversationId:c.id}});await tx.humanHandoff.deleteMany({where:{conversationId:c.id}});await tx.agentJob.deleteMany({where:{conversationId:c.id}});await tx.message.deleteMany({where:{conversationId:c.id}});
    // Append-only audit is retained without contacts/messages; delete only synthetic operational records.
    await tx.rateLimit.deleteMany({where:{key:{in:[`message:${c.id}`,`daily:${c.id}`]}}});
    await tx.conversation.delete({where:{id:c.id}});
    await tx.agentLiveTest.update({where:{id:batchId},data:{conversationId:null}});
  },{timeout:30000});
}

export async function runLiveBookingTest(db:PrismaClient,userId:string,date:string):Promise<LiveTestReport>{
  // This check precedes every write, including reports, and cannot be bypassed by request parameters.
  if(!previewTestAllowed())throw new AgentError('PREVIEW_TEST_ONLY');
  if(!await db.user.count({where:{id:userId,active:true,role:'ADMIN'}}))throw new AgentError('FORBIDDEN');
  const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  if(settings.aiAgentMode==='OFF')throw new AgentError('AI_OFF');
  const ready=await readiness(db,settings);
  if(!ready.canRunLiveTest)throw new AgentError('LIVE_TEST_BLOCKED: '+ready.blockers.filter(c=>c.id!=='liveBooking').map(c=>c.label).join(', '));
  const config=await liveConfigFingerprint(db),batchId=randomUUID();
  const report:LiveTestReport={status:'FAILED',steps:liveTestSteps.map(label=>({label,ok:false})),blocker:null,cleaned:false};
  let ctx:ToolContext;
  // Only one synthetic batch at a time; expired batches are reconciled before another run.
  const stale=await db.agentLiveTest.findMany({where:{status:'RUNNING'}});
  for(const b of stale){if(Date.now()-b.startedAt.getTime()<5*60000)throw new AgentError('LIVE_TEST_ALREADY_RUNNING');await cleanupLiveTest(db,b.id);await db.agentLiveTest.update({where:{id:b.id},data:{status:'FAILED',finishedAt:new Date(),report:{blocker:'INTERRUPTED',cleaned:true}}});}
  await db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('agent:live-test'))::text`;
    if(await tx.agentLiveTest.count({where:{status:'RUNNING'}}))throw new AgentError('LIVE_TEST_ALREADY_RUNNING');
    await tx.agentLiveTest.create({data:{id:batchId}});
  });
  const completeStep=(index:number)=>{report.steps[index].ok=true;};
  const tool=async(name:string,args:unknown):Promise<ToolResult>=>{const r=await executeAgentTool(db,ctx,name,args);if(r.error||r.requiresHumanReview)throw new AgentError(String(r.error??'HUMAN_REVIEW_REQUIRED'));return r;};
  async function context(messageId:string){
    const batch=await db.agentLiveTest.findUniqueOrThrow({where:{id:batchId}}),c=await db.conversation.findUniqueOrThrow({where:{id:batch.conversationId!}});
    await db.agentJob.updateMany({where:{conversationId:c.id,status:{in:['RUNNING','PENDING']}},data:{status:'SUPERSEDED',leaseKey:null,leaseUntil:null}});
    const leaseKey=randomUUID();
    const job=await db.agentJob.upsert({where:{messageId},create:{conversationId:c.id,messageId,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+180000)},update:{status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+180000)}});
    return{conversationId:c.id,jobId:job.id,leaseKey,revision:c.revision,mode:'AUTO' as const,state:stateOf(c),previewTestId:batchId};
  }
  try{
    const conversation=await db.$transaction(async tx=>{const c=await tx.conversation.create({data:{channel:'WEBSITE',externalThreadId:`live-test:${batchId}`,locale:'ru'}});await tx.agentLiveTest.update({where:{id:batchId},data:{conversationId:c.id}});return c;});
    const service=settings.aiAllowedServices.includes('regular')?'regular':settings.aiAllowedServices[0];
    const input=qualificationSchema.parse({service,area:50,soilLevel:'NORMAL',extras:[],urgent:false});
    const request=`Синтетический тест: нужна ${service==='regular'?'поддерживающая':'генеральная'} уборка квартиры 50 м², обычное загрязнение, без дополнений, не срочно.`;
    const message=await db.message.create({data:{conversationId:conversation.id,author:'CLIENT',text:request}});
    ctx=await context(message.id);
    const answer=await completeWithFallback(configuredProviders(),[{role:'system',content:'You are qualifying this synthetic Website cleaning request. Call calculatePrice exactly once with the explicit facts. No CRM actions yet.'},{role:'user',content:request}],async(provider,result,errorCode,latencyMs)=>{
      (report.aiAttempts??=[]).push({provider:provider.name,model:provider.model,ok:result!==null,errorCode,latencyMs});
    },AbortSignal.timeout(60000));
    if(answer.toolCalls.length!==1||answer.toolCalls[0].name!=='calculatePrice')throw new AgentError('PRIMARY_DID_NOT_QUALIFY');
    const qualification=qualificationSchema.parse(JSON.parse(answer.toolCalls[0].arguments));
    if(canonicalJson(qualification)!==canonicalJson(input))throw new AgentError('PRIMARY_MISUNDERSTOOD_REQUEST');
    completeStep(0);
    await tool('calculatePrice',qualification);completeStep(1);
    await tool('estimateDuration',{});completeStep(2);
    const candidates=await tool('resolveAddress',{query:'Теразије 1'});
    const rows=candidates.candidates as {placeId:string;text:string}[]|undefined;
    // Explicit synthetic customer's preselected public destination, never an existing customer's address.
    const selected=rows?.find(r=>/^(?:Terazije|Теразије)\s*1(?:[,\s]|$)/i.test(r.text)&&/(?:Beograd|Београд)/i.test(r.text));
    if(!selected)throw new AgentError('TEST_ADDRESS_AMBIGUOUS');
    await tool('resolveAddress',{query:selected.text,placeId:selected.placeId});completeStep(3);
    const slots=await tool('findAvailableSlots',{date,from:`${date}T08:00`,to:`${date}T22:00`});
    const first=(slots.slots as {slotToken:string}[]|undefined)?.[0];if(!first)throw new AgentError('NO_SLOTS');
    completeStep(4);completeStep(5);
    let phone='';for(let i=0;i<5;i++){const candidate=`+38160${randomInt(1000000,9999999)}`;if(!await db.client.count({where:{normalizedPhone:normalizedPhone(candidate)}})){phone=candidate;break;}}if(!phone)throw new AgentError('SYNTHETIC_CONTACT_COLLISION');
    await tool('createOrUpdateLead',{intent:'cleaning',name:`Preview test ${batchId}`,phone});
    await tool('validateSlot',{slotToken:first.slotToken});completeStep(6);
    const c=await db.conversation.findUniqueOrThrow({where:{id:conversation.id}}),pending=stateOf(c).pending;if(!pending)throw new AgentError('RECAP_REQUIRED');
    const confirmed=await acceptMessage(db,c,{id:randomUUID(),text:'Подтверждаю все условия тестовой записи',locale:'ru',confirmationNonce:pending.nonce});
    ctx=await context(confirmed.messageId);
    const booked=await tool('createOrder',{});if(!booked.booked)throw new AgentError('BOOKING_NOT_CREATED');completeStep(7);
    report.status='PASSED';
  }catch(e){report.blocker=e instanceof AgentError?e.code:'LIVE_TEST_FAILED';}
  try{await cleanupLiveTest(db,batchId);report.cleaned=true;}catch{report.status='FAILED';report.blocker='LIVE_TEST_CLEANUP_REQUIRED';}
  if(report.status==='PASSED'&&report.cleaned){
    if(config!==await liveConfigFingerprint(db)){report.status='FAILED';report.blocker='CONFIGURATION_CHANGED_DURING_TEST';}
    else{report.proof=signLiveProof(config,batchId);await db.businessSettings.update({where:{id:'default'},data:{aiLiveTestProof:json(report.proof)}});}
  }
  await db.agentLiveTest.update({where:{id:batchId},data:{status:report.status,finishedAt:new Date(),report:json(report)}});
  await writeAudit(db,{type:'USER',userId},{action:'AI_PREVIEW_BOOKING_TEST',entityType:'AgentLiveTest',entityId:batchId,changes:{status:{before:null,after:report.status}}});
  return report;
}
