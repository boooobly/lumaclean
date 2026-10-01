import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type Conversation } from "@/generated/prisma/client";
import { z } from "zod";
import { schedulingLock } from "@/lib/services/scheduling-commands";
import { writeAudit } from "@/lib/services/audit";
import { AgentError, type AgentState, type AgentLocale } from "./contracts";
import { detectLocale, confirmsRecap, rescheduleIntent } from "./policy";
import { json, stateOf } from "./tools";
import { channelAdapter, type InboundEvent } from "./channels";

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
  const conversation=await db.conversation.create({data:{channel:"WEBSITE",locale,anonymousHash:anonymousHash(token),sessionExpiresAt:new Date(Date.now()+30*86400000)}});
  return{token,conversation};
}
export async function acceptMessage(db:PrismaClient,c:Conversation,input:{id:string;text:string;locale:string;confirmationNonce?:string}){
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
    if(count>=200)throw new AgentError("CONVERSATION_LIMIT");
    const state=stateOf(current);
    const confirmation=!!state.pending&&(input.confirmationNonce===state.pending.nonce||confirmsRecap(input.text,state.pending.recap));
  if(input.confirmationNonce&&input.confirmationNonce!==state.pending?.nonce)throw new AgentError("INVALID_CONFIRMATION");
    const message=await tx.message.create({data:{conversationId:c.id,author:"CLIENT",text:input.text,externalMessageId:`in:${input.id}`}});
    if(confirmation)state.pending!.confirmedByMessageId=message.id;
    else if(state.pending)delete state.pending;
    if(rescheduleIntent(input.text)){state.rescheduleRequested=true;delete state.booking;}
    await tx.conversation.update({where:{id:c.id},data:{locale:detectLocale(input.text,input.locale),state:json(state),revision:{increment:1},unreadCount:{increment:1},lastMessageAt:new Date(),needsAttention:true,shadowProposal:Prisma.DbNull}});
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
  const messages=await db.message.findMany({where:{conversationId:c.id,deliveryStatus:"DELIVERED",author:{in:["CLIENT","AI","ADMIN","SYSTEM"]}},orderBy:{sentAt:"desc"},take:50,select:{id:true,author:true,text:true,sentAt:true,structured:true}});
  const pending=await db.agentJob.count({where:{conversationId:c.id,status:{in:["PENDING","RUNNING"]}}});
  return{messages:messages.reverse(),control:latest.control,locale:latest.locale,pending:pending>0,confirmation:state.pending?{nonce:state.pending.nonce,recap:state.pending.recap}:null,booking:state.booking?{reference:state.booking.reference,recap:(({orderId,reference,...r})=>{void orderId;void reference;return r;})(state.booking)}:null};
}
export const inboxCommandSchema=z.discriminatedUnion("action",[
  z.object({action:z.enum(["takeover","resume","close","read","retry"]),id:z.string().min(1).max(80)}).strict(),
  z.object({action:z.literal("reply"),id:z.string().min(1).max(80),requestId:z.uuid(),text:z.string().trim().min(1).max(3000)}).strict(),
  z.object({action:z.literal("mode"),mode:z.enum(["OFF","SHADOW","AUTO"]),confirmAuto:z.literal(true).optional()}).strict(),
  z.object({action:z.literal("verifyIdentity"),id:z.string().min(1).max(80),clientId:z.string().min(1).max(80),verificationConfirmed:z.literal(true)}).strict(),
]);
export async function runInboxCommand(db:PrismaClient,userId:string,payload:unknown){
  const input=inboxCommandSchema.parse(payload);
  return db.$transaction(async tx=>{
    const user=await tx.user.findUnique({where:{id:userId},select:{active:true,role:true}});
    if(!user?.active||user.role!=="ADMIN")throw new AgentError("FORBIDDEN");
    if(input.action==="mode"){
      if(input.mode==="AUTO"&&(!input.confirmAuto||process.env.AI_AGENT_ENABLED!=="true"||!process.env.PRIMARY_AGENT_MODEL||!process.env.FALLBACK_AGENT_MODEL))throw new AgentError("AUTO_CONFIRMATION_REQUIRED");
      await tx.businessSettings.update({where:{id:"default"},data:{aiAgentMode:input.mode}});
      await tx.conversation.updateMany({where:{control:"AI_CONTROL"},data:{revision:{increment:1}}});
      await writeAudit(tx,{type:"USER",userId},{action:"AI_AGENT_MODE_CHANGED",entityType:"BusinessSettings",entityId:"default",changes:{status:{before:null,after:input.mode}}});
      return{ok:true};
    }
    await schedulingLock(tx,"conversation",input.id);
    const c=await tx.conversation.findUniqueOrThrow({where:{id:input.id}});
    if(input.action==="reply"){
      if(c.control!=="HUMAN_CONTROL")throw new AgentError("TAKEOVER_REQUIRED");
      await tx.message.upsert({where:{conversationId_externalMessageId:{conversationId:c.id,externalMessageId:`admin:${input.requestId}`}},create:{conversationId:c.id,userId,author:"ADMIN",text:input.text,externalMessageId:`admin:${input.requestId}`,deliveryStatus:c.channel==="WEBSITE"?"DELIVERED":"PENDING"},update:{}});
      await tx.conversation.update({where:{id:c.id},data:{ownerId:userId,lastMessageAt:new Date(),needsAttention:false,unreadCount:0,revision:{increment:1}}});
    }else if(input.action==="verifyIdentity"){
      if(c.control!=="HUMAN_CONTROL")throw new AgentError("TAKEOVER_REQUIRED");
      await tx.client.findUniqueOrThrow({where:{id:input.clientId}});
      const state:AgentState={};
      await tx.conversation.update({where:{id:c.id},data:{clientId:input.clientId,orderId:null,identityVerified:true,state:json(state),shadowState:json({}),revision:{increment:1},shadowProposal:Prisma.DbNull}});
    }else if(input.action==="read"){
      await tx.conversation.update({where:{id:c.id},data:{unreadCount:0}});
    }else if(input.action==="retry"){
      await tx.agentJob.updateMany({where:{conversationId:c.id,status:{in:["FAILED","PENDING"]}},data:{status:"PENDING",leaseUntil:null,leaseKey:null,errorCode:null}});
    }else{
      const state=stateOf(c);delete state.pending;
      const control=input.action==="takeover"?"HUMAN_CONTROL":input.action==="close"?"CLOSED":"AI_CONTROL";
      await tx.conversation.update({where:{id:c.id},data:{control,ownerId:control==="HUMAN_CONTROL"?userId:null,stage:control==="CLOSED"?"CLOSED":input.action==="resume"?"DISCOVERY":c.stage,state:json(state),revision:{increment:1},unreadCount:0,needsAttention:false,shadowProposal:Prisma.DbNull}});
      await tx.message.updateMany({where:{conversationId:c.id,author:"AI",deliveryStatus:"PENDING"},data:{deliveryStatus:"CANCELLED"}});
      if(input.action==="resume"){
        await tx.humanHandoff.updateMany({where:{conversationId:c.id,resolvedAt:null},data:{resolvedAt:new Date(),resolvedById:userId,resolution:"Возврат AI владельцем"}});
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
    const settings=await db.businessSettings.findUniqueOrThrow({where:{id:"default"},select:{aiAgentMode:true}});
    if(row.author==="AI"&&(process.env.AI_AGENT_ENABLED!=="true"||settings.aiAgentMode!=="AUTO"||current.control!=="AI_CONTROL"&&current.ownerId)){await db.message.update({where:{id:row.id},data:{deliveryStatus:"CANCELLED"}});continue;}
    const result=await channelAdapter(current.channel).send({id:row.id,externalThreadId:current.externalThreadId??"",text:row.text});
    await db.message.update({where:{id:row.id},data:{deliveryStatus:result.status,deliveryError:result.errorCode??null,channelMessageId:result.externalMessageId??null}});
    if(result.status!=="DELIVERED")await db.conversation.update({where:{id:current.id},data:{needsAttention:true}});
  }
  await db.message.updateMany({where:{deliveryStatus:"SENDING",sentAt:{lt:new Date(Date.now()-180000)}},data:{deliveryStatus:"UNKNOWN",deliveryError:"DELIVERY_OUTCOME_UNKNOWN"}});
}
