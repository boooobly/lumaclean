import {whatsappFixtureDatabase} from './knowledge/preview-whatsapp';
import {knowledgeScenarios} from './knowledge-scenarios';
import {randomUUID} from 'node:crypto';
import type {PrismaClient} from '@/generated/prisma/client';
import {AgentError,type AgentState} from './contracts';
import {configuredProviders} from './providers';
import {previewTestAllowed} from './live-proof';
import {acceptMessage,acceptChannelMessage} from './inbox';
import {claimJob,runClaimedJob} from './runner';
import {effectiveMode} from './readiness';

export const conversationScenarios={
 ...knowledgeScenarios,
 golden:{locale:'ru',texts:['Здравствуйте, хочу заказать клининг','Обычная уборка','88','Да, мне нужно холодильник помыть и духовку. Сколько это всё будет стоить?','Обычное загрязнение','Да, я же написал','Да, мне нужно холодильник помыть и духовку. Сколько это всё будет стоить?']},
 corrections:{locale:'en',texts:['I want regular cleaning for 88 m², normal dirt, inside two fridges and one oven. How much will it cost?','Remove the oven, keep the fridges','Inside the dishwasher as well','No, the area is 80 m²','How much will it cost now?','Do you bring your own equipment?','What payment methods are available?','Can you clean homes with pets?','Nothing else','How much will it cost?','How much without the fridge?','Inside the oven again','How much will it cost now?']},
 natural:{locale:'ru',texts:['Хочу генеральную уборку, квартира 80 м²','Без дополнительных услуг','Квартира не запущена: обычная пыль и следы быта','Да, верно','Сколько будет стоить?','Хочу холодильник изнутри и духовку изнутри','Духовку не надо, холодильник оставляем','Нет, площадь 88 м²','Больше ничего','Сколько это будет стоить?']},
 cyrl:{locale:'sr-Cyrl',texts:['Желим генерално чишћење стана 80 м²','Фрижидер и рерна','Уобичајена запрљаност','Колико све кошта?','Без рерне, фрижидер остављамо','Микроталасна изнутра','Не, 88 м²','Без додатних услуга','Да ли користите своја средства?','Колико све кошта?']},
} as const;
export type ConversationScenario=keyof typeof conversationScenarios;
type Input={action:'start'|'turn'|'cleanup';scenario:ConversationScenario;provider:'primary'|'fallback';conversationId?:string};
/** Fixed synthetic scripts only; ordinary metered runner and all production safety checks. */
export async function conversationPreview(db:PrismaClient,userId:string,input:Input){
 if(!previewTestAllowed()||!new URL(process.env.DATABASE_URL!).hostname.startsWith('ep-wispy-river-b8xwqy9q'))throw new AgentError('ISOLATED_PREVIEW_REQUIRED');
 const prefix=`reliability-native:${userId}:${input.scenario}:${input.provider}:`,scenario=conversationScenarios[input.scenario];
 const channel='channel' in scenario?scenario.channel:'WEBSITE';
 if(channel==='WHATSAPP')db=whatsappFixtureDatabase(db);
 if(input.action==='start'){
  const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  if(effectiveMode(settings,'WEBSITE')!=='AUTO')throw new AgentError('PREVIEW_WEBSITE_AUTO_REQUIRED');
  const c=await db.conversation.create({data:{channel,locale:scenario.locale,externalThreadId:prefix+randomUUID(),displayAlias:'Mila'}});
  return{conversationId:c.id,steps:scenario.texts.length};
 }
 if(!input.conversationId)throw new AgentError('CONVERSATION_REQUIRED');
 const c=await db.conversation.findUniqueOrThrow({where:{id:input.conversationId}});
 if(!c.externalThreadId?.startsWith(prefix)||c.channel!==channel||c.anonymousHash||c.identityVerified||c.orderId||Date.now()-c.createdAt.getTime()>3600000)throw new AgentError('PREVIEW_NAMESPACE_INVALID');
 if(input.action==='cleanup'){
  if(c.leadId&&!await db.lead.count({where:{id:c.leadId,submissionId:`agent:${c.id}`}}))throw new AgentError('PREVIEW_CLEANUP_REVIEW_REQUIRED');
  await db.$transaction(async tx=>{
   const scope={conversationId:c.id};
   await tx.notification.deleteMany({where:scope});await tx.agentToolTrace.deleteMany({where:scope});await tx.aIInvocation.deleteMany({where:scope});await tx.shadowSuggestion.deleteMany({where:scope});await tx.agentSlot.deleteMany({where:scope});await tx.humanHandoff.deleteMany({where:scope});await tx.agentJob.deleteMany({where:scope});
   await tx.message.updateMany({where:scope,data:{responseToMessageId:null}});await tx.message.deleteMany({where:scope});await tx.conversation.delete({where:{id:c.id}});
   if(c.leadId){await tx.leadExtra.deleteMany({where:{leadId:c.leadId}});await tx.lead.delete({where:{id:c.leadId}});}
  },{timeout:30000});
  return{cleaned:true};
 }
 const index=await db.message.count({where:{conversationId:c.id,author:'CLIENT'}});
 if(index>=scenario.texts.length)throw new AgentError('SCENARIO_FINISHED');
 if(c.control!=='AI_CONTROL')throw new AgentError('UNEXPECTED_HUMAN_CONTROL');
 const providers=configuredProviders(),selected=input.provider==='primary'?providers:[providers[1],providers[0]] as typeof providers;
 const started=Date.now();
 const incomingId=randomUUID(),incoming={channel:'WHATSAPP' as const,externalThreadId:c.externalThreadId!,externalUserId:c.externalThreadId!,externalMessageId:incomingId,text:scenario.texts[index],locale:scenario.locale,receivedAt:new Date()};
 const accepted=channel==='WHATSAPP'?await acceptChannelMessage(db,incoming):await acceptMessage(db,c,{id:incomingId,text:scenario.texts[index]});
 if(channel==='WHATSAPP'&&(await acceptChannelMessage(db,incoming)).messageId!==accepted.messageId)throw new AgentError('PREVIEW_IDEMPOTENCY_FAILED');
 const claim=await claimJob(db,c.id);if(!claim)throw new AgentError('JOB_NOT_CLAIMED');
 let capturedSends=0;
 await runClaimedJob(db,claim,selected,async()=>({images:[],count:0}),()=>({send:async()=>{capturedSends++;return{status:'SENT',externalMessageId:'synthetic-only:'+randomUUID()};}}));
 const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=live.state as AgentState;
 const [response,tools,invocations,lead]=await Promise.all([
  db.message.findUniqueOrThrow({where:{responseToMessageId:accepted.messageId},select:{text:true,structured:true}}),
  db.agentToolTrace.findMany({where:{jobId:claim.job.id},select:{tool:true,outcome:true,entityId:true,latencyMs:true}}),
  db.aIInvocation.findMany({where:{jobId:claim.job.id},select:{provider:true,success:true,errorCode:true,inputTokens:true,outputTokens:true,latencyMs:true,estimatedCostUsd:true}}),
  live.leadId?db.lead.findUnique({where:{id:live.leadId},select:{estimatedPrice:true,extras:{select:{quantity:true,unitPrice:true,extra:{select:{code:true}}}}}}):null,
 ]);
 const {name,phone,addressQuery,neighborhoodHint,...safeFacts}=state.draftFacts??{};void name;void phone;void addressQuery;void neighborhoodHint;
 return{channel,capturedSends,externalDelivery:false,elapsedMs:Date.now()-started,step:index+1,provider:selected[0].name,nativeComplete:invocations.length>0&&invocations.every(i=>i.success&&i.provider===selected[0].name),inconclusive:invocations.some(i=>!i.success||i.provider!==selected[0].name),facts:safeFacts,quote:state.quote?{total:state.quote.total,base:state.quote.base,breakdown:state.quote.breakdown}:null,nextInput:state.nextInput,unresolvedInput:state.unresolvedInput,proposal:!!state.pendingFactProposal,review:state.review?.reasons??[],control:live.control,booking:!!state.booking,revision:live.revision,reliability:state.reliability,tools,invocations,response:response.text,recovery:(response.structured as {autonomy?:{recovery?:boolean}}|null)?.autonomy?.recovery??false,lead:lead?{estimate:lead.estimatedPrice?Number(lead.estimatedPrice):null,extras:lead.extras.map(e=>({code:e.extra.code,quantity:Number(e.quantity),unitPrice:Number(e.unitPrice)}))}:null};
}
