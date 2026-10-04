import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type Conversation } from "@/generated/prisma/client";
import { z } from "zod";
import { schedulingLock } from "@/lib/services/scheduling-commands";
import { writeAudit } from "@/lib/services/audit";
import { AgentError, type AgentState, type AgentLocale } from "./contracts";
import { detectLocale, confirmsRecap, rescheduleIntent } from "./policy";
import { json, stateOf } from "./tools";
import { channelAdapter, type InboundEvent } from "./channels";
import { assertAutoReady, effectiveMode } from './readiness';
import { resolveHandoffNotifications } from './telegram-handoff';
import {chooseAlias,activeReplySet,replyText,isReplyKey,replyFacts} from './chat-presentation';
import {applyCustomerFacts,explicitCustomerFacts} from './customer-facts';
import {buildAgentTemporalContext} from './temporal';
import {behaviorMetric} from './behavior-telemetry';
import {attachmentSelect} from './chat-attachments';

export const anonymousHash=(token:string)=>createHash("sha256").update(token).digest("hex");
export async function rateLimit(db:PrismaClient,scope:string,max:number,periodMs=60000){
  const now=Date.now(),key=`agent:${scope}:${Math.floor(now/periodMs)}`;
  const result=await db.$queryRaw<{count:number}[]>`INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES (${randomUUID()},${key},1,${BigInt(now)}) ON CONFLICT (key) DO UPDATE SET count="RateLimit".count+1 RETURNING count`;
  if(result[0].count>max)throw new AgentError("RATE_LIMIT");
}
export async function scopedConversation(db:PrismaClient,token:string|null){
  if(!token||!/^[a-f0-9]{64}$/.test(token))return null;
  return db.conversation.findFirst({where:{anonymousHash:anonymousHash(token),channel:"WEBSITE",sessionExpiresAt:{gt:new Date()}}});
}
export async function startWebsiteConversation(db:PrismaClient,locale:AgentLocale,ipHash:string){
  await rateLimit(db,`new:${ipHash}`,12,86400000);
  const token=randomBytes(32).toString("hex");
  const recent=await db.conversation.findMany({where:{channel:'WEBSITE'},orderBy:{createdAt:'desc'},take:3,select:{displayAlias:true}});
  const conversation=await db.conversation.create({data:{channel:"WEBSITE",locale,displayAlias:chooseAlias(recent.map(c=>c.displayAlias)),anonymousHash:anonymousHash(token),sessionExpiresAt:new Date(Date.now()+30*86400000)}});
  return{token,conversation};
}
export async function acceptMessage(db:PrismaClient,c:Conversation,input:{id:string;text:string;locale?:string;confirmationNonce?:string;attachmentIds?:string[];quickReply?:{key:string;messageId:string;replySetId:string;revision:number}}){
  const receivedAt=new Date();
  const accepted=await db.message.findUnique({where:{conversationId_externalMessageId:{conversationId:c.id,externalMessageId:`in:${input.id}`}}});
  if(accepted)return{messageId:accepted.id,created:false};
  await rateLimit(db,`message:${c.id}`,8);
  await rateLimit(db,`daily:${c.id}`,80,86400000);
  return db.$transaction(async tx=>{
    await schedulingLock(tx,"conversation",c.id);
    const current=await tx.conversation.findUniqueOrThrow({where:{id:c.id}});
    const duplicate=await tx.message.findUnique({where:{conversationId_externalMessageId:{conversationId:c.id,externalMessageId:`in:${input.id}`}}});
    if(duplicate)return{messageId:duplicate.id,created:false};
    if(current.control==="CLOSED")throw new AgentError("CONVERSATION_CLOSED");
    const count=await tx.message.count({where:{conversationId:c.id,author:"CLIENT"}});
    const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    if(count>=Math.min(1000,Math.max(1,settings.aiMaxAnonymousMessages)))throw new AgentError("CONVERSATION_LIMIT");
    const state=stateOf(current);
    let text=input.text;
    const previousAnswer=await tx.message.findFirst({where:{conversationId:c.id,author:'AI'},orderBy:[{sentAt:'desc'},{id:'desc'}]});
    const activeSet=activeReplySet(previousAnswer?.structured,current.revision,current.control);
    if(input.quickReply){
      const last=await tx.message.findFirst({where:{conversationId:c.id},orderBy:[{sentAt:'desc'},{id:'desc'}]});
      const q=input.quickReply;
      if(current.revision!==q.revision||last?.id!==q.messageId||last.author!=='AI'||activeSet?.id!==q.replySetId||!activeSet.choices.some(r=>r.key===q.key)){behaviorMetric('staleQuickReplyRejected');throw new AgentError('STALE_QUICK_REPLY');}
      applyCustomerFacts(state,replyFacts(q.key));
      if(isReplyKey(q.key))text=replyText(q.key,current.locale);
      else{const slot=state.slots?.find(s=>`SLOT:${s.token}`===q.key);if(!slot||!await tx.agentSlot.count({where:{id:slot.token,conversationId:c.id,expiresAt:{gt:new Date()},usedAt:null}}))throw new AgentError('STALE_SLOT');state.selectedSlotToken=slot.token;text=`${current.locale==='ru'?'Выбираю время':current.locale==='en'?'I select this time':current.locale==='sr-Cyrl'?'Бирам термин':'Biram termin'}: ${new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Belgrade',dateStyle:'short',timeStyle:'short'}).format(new Date(slot.start))}`;}
    }
    if(activeSet&&previousAnswer){await tx.message.update({where:{id:previousAnswer.id},data:{structured:json({...previousAnswer.structured as object,replySet:{...activeSet,consumedAt:new Date().toISOString()}})}});}
    if(/утром|дн[её]м|вечером|в два|ujutru|popodne|uveče|ујутру|поподне|увече|\b(?:morning|afternoon|evening|at two)\b/iu.test(text)&&!/[0-2]?\d[:–-][0-5]?\d|\b\d{1,2}\s*(?:am|pm|час)/iu.test(text))state.timeClarificationRequired=true;
    else if(/\d{1,2}[:–-]\d{1,2}|\d{1,2}\s*(?:am|pm|час)|(?:в|у|at|u)\s+\d{1,2}(?=\s|$|[,.])/iu.test(text))delete state.timeClarificationRequired;
    const expectedInput=state.nextInput;delete state.nextInput;
    applyCustomerFacts(state,explicitCustomerFacts(text,receivedAt,settings.timezone,expectedInput),buildAgentTemporalContext(new Date(),settings).nowLocalDate);
    const ids=[...new Set(input.attachmentIds??[])];
    if(ids.length>4||ids.length!==input.attachmentIds?.length&&!!input.attachmentIds)throw new AgentError('INVALID_ATTACHMENTS');
    if(ids.length&&await tx.chatAttachment.count({where:{id:{in:ids},conversationId:c.id,messageId:null,uploader:'CLIENT',processingStatus:'READY'}})!==ids.length)throw new AgentError('INVALID_ATTACHMENTS');
    const confirmation=!!state.pending&&(input.confirmationNonce===state.pending.nonce||confirmsRecap(text,state.pending.recap));
  if(input.confirmationNonce&&input.confirmationNonce!==state.pending?.nonce)throw new AgentError("INVALID_CONFIRMATION");
    const message=await tx.message.create({data:{conversationId:c.id,author:"CLIENT",text,sentAt:receivedAt,externalMessageId:`in:${input.id}`}});
    if(ids.length)await tx.chatAttachment.updateMany({where:{id:{in:ids},conversationId:c.id,messageId:null},data:{messageId:message.id}});
    if(confirmation)state.pending!.confirmedByMessageId=message.id;
    else if(state.pending)delete state.pending;
    if(rescheduleIntent(text)){state.rescheduleRequested=true;delete state.booking;}
    await tx.conversation.update({where:{id:c.id},data:{locale:detectLocale(text,current.locale),operatorTypingUntil:null,state:json(state),revision:{increment:1},unreadCount:{increment:1},lastMessageAt:new Date(),needsAttention:true,shadowProposal:Prisma.DbNull}});
    await tx.agentJob.create({data:{conversationId:c.id,messageId:message.id}});
    return{messageId:message.id,created:true};
  });
}
export async function acceptChannelMessage(db:PrismaClient,event:InboundEvent){
  const c=await db.conversation.upsert({where:{channel_externalThreadId:{channel:event.channel,externalThreadId:event.externalThreadId}},create:{channel:event.channel,externalThreadId:event.externalThreadId,locale:event.locale},update:{}});
  return acceptMessage(db,c,{id:event.externalMessageId,text:event.text,locale:c.locale});
}
export async function publicConversation(db:PrismaClient,c:Conversation){
  const latest=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=stateOf(latest);
  const messages=await db.message.findMany({where:{conversationId:c.id,deliveryStatus:"DELIVERED",author:{in:["CLIENT","AI","ADMIN","SYSTEM"]}},orderBy:[{sentAt:"desc"},{id:'desc'}],take:50,select:{id:true,author:true,text:true,sentAt:true,readAt:true,structured:true,externalMessageId:true,attachments:{select:attachmentSelect}}});
  const jobs=await db.agentJob.findMany({where:{conversationId:c.id,status:{in:["PENDING","RUNNING"]}},select:{status:true,leaseUntil:true}});
  const notifications=await db.notification.findMany({where:{conversationId:c.id,audience:"CLIENT",clientId:latest.clientId,deliveryState:"INTERNAL",scheduledAt:{lte:new Date()}},orderBy:{scheduledAt:"desc"},take:10,select:{id:true,text:true,kind:true,scheduledAt:true}});
  const last=messages[0],set=last?.author==='AI'?activeReplySet(last.structured,latest.revision,latest.control):null;
  return{notifications,messages:messages.reverse().map(({externalMessageId,...m})=>({...m,...(m.author==='CLIENT'?{requestId:externalMessageId?.startsWith('in:')?externalMessageId.slice(3):null}:{})})),displayAlias:latest.displayAlias,revision:latest.revision,quickReplies:set&&!['BOOKING_CONFIRMATION','POST_BOOKING'].includes(set.intent)?{messageId:last.id,replySetId:set.id,revision:set.conversationRevision,choices:set.choices}:null,typing:latest.control==='HUMAN_CONTROL'?!!latest.operatorTypingUntil&&latest.operatorTypingUntil>new Date():latest.control==='AI_CONTROL'&&jobs.some(j=>j.status==='RUNNING'&&!!j.leaseUntil&&j.leaseUntil>new Date()),control:latest.control,locale:latest.locale,pending:jobs.length>0,confirmation:state.pending?{nonce:state.pending.nonce,recap:state.pending.recap}:null,booking:state.booking?{reference:state.booking.reference,recap:(({orderId,reference,...r})=>{void orderId;void reference;return r;})(state.booking)}:null};
}
export const inboxCommandSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal('typing'),id:z.string().min(1).max(80),active:z.boolean()}).strict(),
  z.object({action:z.enum(["takeover","resume","close","retry"]),id:z.string().min(1).max(80)}).strict(),
  z.object({action:z.literal('read'),id:z.string().min(1).max(80),messageId:z.string().min(1).max(80).optional()}).strict(),
  z.object({action:z.literal("reply"),id:z.string().min(1).max(80),requestId:z.uuid(),text:z.string().trim().max(3000),attachmentIds:z.array(z.uuid()).max(4).optional()}).strict().refine(v=>!!v.text||!!v.attachmentIds?.length),
  z.object({action:z.literal("mode"),mode:z.enum(["OFF","SHADOW","AUTO"]),confirmAuto:z.literal(true).optional()}).strict(),
  z.object({action:z.literal("verifyIdentity"),id:z.string().min(1).max(80),clientId:z.string().min(1).max(80),verificationConfirmed:z.literal(true)}).strict(),
  z.object({action:z.literal('evaluate'),id:z.string().min(1).max(80),suggestionId:z.string().min(1).max(80),verdict:z.enum(['ACCEPTED','REJECTED']),reason:z.enum(['MISUNDERSTOOD','TONE','EXTRA_QUESTION','TOOL','PRICE','SCHEDULING','OTHER']).optional()}).strict(),
]);
export async function runInboxCommand(db:PrismaClient,userId:string,payload:unknown){
  const input=inboxCommandSchema.parse(payload);
  return db.$transaction(async tx=>{
    const user=await tx.user.findUnique({where:{id:userId},select:{active:true,role:true}});
    if(!user?.active||user.role!=="ADMIN")throw new AgentError("FORBIDDEN");
    if(input.action==="mode"){
      await schedulingLock(tx,'settings','ai');
      if(input.mode==="AUTO"&&(!input.confirmAuto||process.env.AI_AGENT_ENABLED!=="true"||!process.env.PRIMARY_AGENT_MODEL||!process.env.FALLBACK_AGENT_MODEL))throw new AgentError("AUTO_CONFIRMATION_REQUIRED");
      if(input.mode==='AUTO')await assertAutoReady(tx);
      await tx.businessSettings.update({where:{id:"default"},data:{aiAgentMode:input.mode,...(input.mode==='AUTO'?{aiChannelModes:{WEBSITE:'AUTO',TELEGRAM:'OFF',WHATSAPP:'OFF',VIBER:'OFF'}}:{})}});
      await tx.conversation.updateMany({where:{control:"AI_CONTROL"},data:{revision:{increment:1}}});
      await writeAudit(tx,{type:"USER",userId},{action:"AI_AGENT_MODE_CHANGED",entityType:"BusinessSettings",entityId:"default",changes:{status:{before:null,after:input.mode}}});
      return{ok:true};
    }
    await schedulingLock(tx,"conversation",input.id);
    const c=await tx.conversation.findUniqueOrThrow({where:{id:input.id}});
    if(input.action==='typing'){
      if(c.control!=='HUMAN_CONTROL'||c.ownerId!==userId)throw new AgentError('TAKEOVER_REQUIRED');
      await tx.conversation.update({where:{id:c.id},data:{operatorTypingUntil:input.active?new Date(Date.now()+7000):null}});
      return{ok:true};
    }
    if(input.action==='evaluate'){
      if(input.verdict==='REJECTED'&&!input.reason)throw new AgentError('REJECTION_REASON_REQUIRED');
      const suggestion=await tx.shadowSuggestion.findFirst({where:{id:input.suggestionId,conversationId:c.id}});
      if(!suggestion)throw new AgentError('SUGGESTION_NOT_FOUND');
      await tx.shadowSuggestion.update({where:{id:suggestion.id},data:{verdict:input.verdict,reason:input.verdict==='REJECTED'?input.reason:null,reviewedById:userId,reviewedAt:new Date()}});
    }else if(input.action==="reply"){
      if(c.control!=="HUMAN_CONTROL")throw new AgentError("TAKEOVER_REQUIRED");
      const existing=await tx.message.findUnique({where:{conversationId_externalMessageId:{conversationId:c.id,externalMessageId:`admin:${input.requestId}`}}});
      if(!existing){const ids=[...new Set(input.attachmentIds??[])];if(ids.length&&await tx.chatAttachment.count({where:{id:{in:ids},conversationId:c.id,messageId:null,uploader:'ADMIN'}})!==ids.length)throw new AgentError('INVALID_ATTACHMENTS');const message=await tx.message.create({data:{conversationId:c.id,userId,author:"ADMIN",text:input.text,externalMessageId:`admin:${input.requestId}`,deliveryStatus:c.channel==="WEBSITE"?"DELIVERED":"PENDING"}});if(ids.length)await tx.chatAttachment.updateMany({where:{id:{in:ids}},data:{messageId:message.id}});}
      await tx.message.updateMany({where:{conversationId:c.id,author:'CLIENT',readAt:null},data:{readAt:new Date()}});
      await tx.conversation.update({where:{id:c.id},data:{operatorTypingUntil:null,ownerId:userId,lastMessageAt:new Date(),needsAttention:false,unreadCount:0,revision:{increment:1}}});
      await resolveHandoffNotifications(tx,c.id,userId,'Ответ оператора в Inbox');
    }else if(input.action==="verifyIdentity"){
      if(c.control!=="HUMAN_CONTROL")throw new AgentError("TAKEOVER_REQUIRED");
      await tx.client.findUniqueOrThrow({where:{id:input.clientId}});
      const state:AgentState={};
      await tx.conversation.update({where:{id:c.id},data:{clientId:input.clientId,orderId:null,identityVerified:true,state:json(state),shadowState:json({}),revision:{increment:1},shadowProposal:Prisma.DbNull}});
    }else if(input.action==="read"){
      const through=input.messageId?await tx.message.findFirst({where:{id:input.messageId,conversationId:c.id,author:'CLIENT'}}):null;
      if(input.messageId&&!through)throw new AgentError('INVALID_MESSAGE');
      if(c.control==='HUMAN_CONTROL')await tx.message.updateMany({where:{conversationId:c.id,author:'CLIENT',readAt:null,...(through?{sentAt:{lte:through.sentAt}}:{})},data:{readAt:new Date()}});
      await tx.conversation.update({where:{id:c.id},data:{unreadCount:0}});
    }else if(input.action==="retry"){
      const retried=await tx.agentJob.updateMany({where:{conversationId:c.id,status:{in:["FAILED","PENDING"]}},data:{status:"PENDING",leaseUntil:null,leaseKey:null,errorCode:null,completedAt:null}});
      // A new revision also produces a new queue idempotency key for an explicit owner retry.
      if(retried.count)await tx.conversation.update({where:{id:c.id},data:{revision:{increment:1},shadowProposal:Prisma.DbNull,needsAttention:true}});
    }else{
      const state=stateOf(c);delete state.pending;
      const control=input.action==="takeover"?"HUMAN_CONTROL":input.action==="close"?"CLOSED":"AI_CONTROL";
      await tx.conversation.update({where:{id:c.id},data:{operatorTypingUntil:null,closedAt:control==='CLOSED'?new Date():null,control,ownerId:control==="HUMAN_CONTROL"?userId:null,stage:control==="CLOSED"?"CLOSED":input.action==="resume"?"DISCOVERY":c.stage,state:json(state),revision:{increment:1},unreadCount:0,needsAttention:false,shadowProposal:Prisma.DbNull}});
      await tx.message.updateMany({where:{conversationId:c.id,author:"AI",deliveryStatus:"PENDING"},data:{deliveryStatus:"CANCELLED"}});
      await resolveHandoffNotifications(tx,c.id,userId,input.action==='takeover'?'Клиент забран в Inbox':input.action==='close'?'Диалог закрыт':'Возврат AI владельцем');
      if(input.action==="resume"){
        const last=await tx.message.findFirst({where:{conversationId:c.id,author:"CLIENT"},orderBy:{sentAt:"desc"}});
        if(last)await tx.agentJob.upsert({where:{messageId:last.id},create:{conversationId:c.id,messageId:last.id},update:{status:"PENDING",attempts:0,leaseUntil:null,errorCode:null}});
      }
    }
    await writeAudit(tx,{type:"USER",userId},{action:`INBOX_${input.action.toUpperCase()}`,entityType:"Conversation",entityId:c.id});
    return{ok:true};
  });
}
/** Durable outbox. UNKNOWN is deliberately not retried: Telegram has no send idempotency key. */
export async function deliverOutbox(db:PrismaClient,conversationId?:string){
  const rows=await db.message.findMany({where:{deliveryStatus:"PENDING",...(conversationId?{conversationId}:{})},include:{conversation:true},orderBy:{sentAt:"asc"},take:12});
  for(const row of rows){
    const claimed=await db.message.updateMany({where:{id:row.id,deliveryStatus:"PENDING"},data:{deliveryStatus:"SENDING",deliveryAttempts:{increment:1}}});
    if(!claimed.count)continue;
    // Re-read control after claiming; owner takeover cancels AI outbox before any new send.
    const current=await db.conversation.findUniqueOrThrow({where:{id:row.conversationId}});
    const settings=await db.businessSettings.findUniqueOrThrow({where:{id:"default"}});
    if(row.author==="AI"&&(effectiveMode(settings,current.channel)!=='AUTO'||current.control!=="AI_CONTROL"&&current.ownerId)){await db.message.update({where:{id:row.id},data:{deliveryStatus:"CANCELLED"}});continue;}
    const result=await channelAdapter(current.channel).send({id:row.id,externalThreadId:current.externalThreadId??"",text:row.text});
    await db.message.update({where:{id:row.id},data:{deliveryStatus:result.status,deliveryError:result.errorCode??null,channelMessageId:result.externalMessageId??null}});
    if(result.status!=="DELIVERED")await db.conversation.update({where:{id:current.id},data:{needsAttention:true}});
  }
  await db.message.updateMany({where:{deliveryStatus:"SENDING",sentAt:{lt:new Date(Date.now()-180000)}},data:{deliveryStatus:"UNKNOWN",deliveryError:"DELIVERY_OUTCOME_UNKNOWN"}});
}
