import type {PrismaClient,Prisma} from "@/generated/prisma/client";
import {stateOf} from "./tools";
import {customerTelegramConfigured} from "./channels";
import {attachmentSelect} from './chat-attachments';
import {effectiveMode} from './readiness';
export const inboxFilters=["ALL","UNREAD","HUMAN","TRANSFERRED","UNREVIEWED","AI","HANDOFF","CLOSED","WEBSITE","TELEGRAM","WHATSAPP","VIBER"] as const;
export async function inboxData(db:PrismaClient,filter:string="ALL",before?:string){
  const where:Prisma.ConversationWhereInput=filter==="UNREAD"?{unreadCount:{gt:0},control:{not:"CLOSED"}}:filter==="HUMAN"?{control:"HUMAN_CONTROL"}:filter==="TRANSFERRED"?{handoffs:{some:{resolvedAt:null}},control:{not:"CLOSED"}}:filter==="AI"?{control:"AI_CONTROL"}:filter==="HANDOFF"?{needsAttention:true,control:{not:"CLOSED"}}:filter==="CLOSED"?{control:"CLOSED"}:filter==="WEBSITE"||filter==="TELEGRAM"||filter==='WHATSAPP'||filter==='VIBER'?{channel:filter}:{};
  if(filter==='UNREVIEWED'){const suggestions=await db.shadowSuggestion.findMany({where:{verdict:null},select:{conversationId:true},orderBy:{createdAt:'desc'},take:500});where.id={in:[...new Set(suggestions.map(s=>s.conversationId))]};}
  where.AND=[{OR:[{externalThreadId:null},{NOT:{externalThreadId:{startsWith:'live-test:'}}}]}];
  if(before&&Number.isFinite(Date.parse(before)))where.lastMessageAt={lt:new Date(before)};
  const [rows,settings,attention]=await Promise.all([
    db.conversation.findMany({where,orderBy:[{lastMessageAt:"desc"},{id:"desc"}],take:101,include:{client:{select:{name:true,phone:true}},lead:{select:{name:true,status:true}},order:{select:{reference:true,status:true}},messages:{take:1,orderBy:{sentAt:"desc"},select:{text:true,author:true,sentAt:true,deliveryStatus:true}}}}),
    db.businessSettings.findUniqueOrThrow({where:{id:"default"}}),
    db.conversation.count({where:{needsAttention:true,control:{not:"CLOSED"}}}),
  ]);
  const owners=await db.user.findMany({where:{id:{in:[...new Set(rows.flatMap(c=>c.ownerId?[c.ownerId]:[]))]}},select:{id:true,name:true}});
  return{rows:rows.slice(0,100).map(c=>({id:c.id,name:c.client?.name??stateOf(c).name??stateOf(c).phone??c.lead?.name??"Новый диалог",phone:c.client?.phone??stateOf(c).phone??null,failedDelivery:["FAILED","UNKNOWN"].includes(c.messages[0]?.deliveryStatus??""),channel:c.channel,mode:effectiveMode(settings,c.channel),control:c.control,stage:c.stage,owner:owners.find(o=>o.id===c.ownerId)?.name??null,unread:c.unreadCount,needsAttention:c.needsAttention,lastMessage:c.messages[0]?.text??"Сообщений пока нет",lastMessageAt:c.lastMessageAt.toISOString(),orderReference:c.order?.reference??null,shadow:!!c.shadowProposal})),next:rows.length>100?rows[99].lastMessageAt.toISOString():null,mode:settings.aiAgentMode,enabled:process.env.AI_AGENT_ENABLED==="true",telegram:customerTelegramConfigured(),attention};
}
export async function conversationData(db:PrismaClient,id:string,before?:string){
  const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  const c=await db.conversation.findUnique({where:{id},include:{client:{select:{id:true,name:true,phone:true}},lead:{select:{id:true,name:true,status:true}},order:{select:{id:true,reference:true,status:true,scheduledStart:true,finalPrice:true,currency:true,service:{select:{name:true}},address:{select:{fullAddress:true}}}},handoffs:{orderBy:{requestedAt:"desc"},take:5},jobs:{orderBy:{createdAt:"desc"},take:5},toolTraces:{orderBy:{createdAt:"desc"},take:20},invocations:{orderBy:{createdAt:"desc"},take:20}}});
  if(!c)return null;
  const rows=await db.message.findMany({where:{conversationId:id,...(before&&Number.isFinite(Date.parse(before))?{sentAt:{lt:new Date(before)}}:{})},orderBy:[{sentAt:"desc"},{id:"desc"}],take:201,include:{attachments:{select:attachmentSelect}}});
  const suggestion=await db.shadowSuggestion.findFirst({where:{conversationId:id},orderBy:{createdAt:"desc"},select:{id:true,verdict:true,reason:true}});
  const state=stateOf(c);
  return{suggestion,id:c.id,displayAlias:c.displayAlias,name:c.client?.name??state.name??state.phone??c.lead?.name??"Новый диалог",phone:c.client?.phone??state.phone??null,client:c.client,lead:c.lead,order:c.order,channel:c.channel,mode:effectiveMode(settings,c.channel),control:c.control,stage:c.stage,locale:c.locale,identityVerified:c.identityVerified,needsAttention:c.needsAttention,ownerId:c.ownerId,messages:rows.slice(0,200).reverse().map(m=>({id:m.id,author:m.author,customerVisible:m.author!=="SYSTEM"||Boolean((m.structured as {notificationId?:string}|null)?.notificationId),text:m.text,attachments:m.attachments,sentAt:m.sentAt.toISOString(),deliveryStatus:m.deliveryStatus,deliveryError:m.deliveryError,providerId:m.channelMessageId??(m.structured as {externalMessageId?:string}|null)?.externalMessageId??null,receivedAt:m.receivedAt?.toISOString()??null,providerSentAt:m.providerSentAt?.toISOString()??null,deliveryUpdatedAt:m.deliveryUpdatedAt?.toISOString()??null,deliveredAt:m.deliveredAt?.toISOString()??null,readAt:m.readAt?.toISOString()??null,replyTo:(m.structured as {replyTo?:string}|null)?.replyTo??null,rejectedAttachments:((m.structured as {attachments?:{kind:string;status:string}[]}|null)?.attachments??[]).filter(a=>a.status!=="READY").map(a=>({kind:a.kind,status:a.status}))})),before:rows.length>200?rows[199].sentAt.toISOString():null,shadow:c.shadowProposal as null|{text:string;plan:{tool:string;outcome:string}[];at:string;stage:string},handoffs:c.handoffs.map(h=>({reason:h.reason,resolved:!!h.resolvedAt,date:h.requestedAt.toISOString()})),jobs:c.jobs.map(j=>({id:j.id,status:j.status,error:j.errorCode,attempts:j.attempts})),traces:c.toolTraces.map(t=>({id:t.id,tool:t.tool,outcome:t.outcome,latency:t.latencyMs,shadow:t.shadow})),invocations:c.invocations.map(i=>({id:i.id,provider:i.provider,model:i.model,latency:i.latencyMs,cost:i.estimatedCostUsd?.toString()??null,input:i.inputTokens,output:i.outputTokens,success:i.success,error:i.errorCode}))};
}
export async function aiAnalytics(db:PrismaClient,days=30){
  const from=new Date(Date.now()-days*86400000),period={gte:from};
  const [conversations,leads,orders,handoffs,cost,models,toolErrors,costConversations]=await Promise.all([
    db.conversation.count({where:{createdAt:period}}),db.lead.count({where:{entrySource:"ai-chat",createdAt:period}}),db.auditLog.count({where:{actorType:"AI",action:"AI_ORDER_CREATED",createdAt:period}}),db.humanHandoff.groupBy({by:["conversationId"],where:{requestedAt:period,conversation:{createdAt:period}}}),
    db.aIInvocation.aggregate({where:{createdAt:period},_sum:{estimatedCostUsd:true},_count:true}),
    db.aIInvocation.groupBy({by:["provider","model"],where:{createdAt:period},_count:true,_sum:{estimatedCostUsd:true,inputTokens:true,outputTokens:true}}),
    db.agentToolTrace.count({where:{createdAt:period,outcome:{notIn:["OK","SHADOW_MUTATION_BLOCKED"]}}}),db.aIInvocation.groupBy({by:["conversationId"],where:{createdAt:period},_count:true}),
  ]);
  const suggestions=await db.shadowSuggestion.count({where:{createdAt:period}}),accepted=await db.shadowSuggestion.count({where:{reviewedAt:period,verdict:"ACCEPTED"}}),rejected=await db.shadowSuggestion.count({where:{reviewedAt:period,verdict:"REJECTED"}});
  const total=Number(cost._sum.estimatedCostUsd??0);
  return{suggestions,accepted,rejected,acceptanceRate:accepted+rejected?accepted/(accepted+rejected)*100:null,reviewed:accepted+rejected,handoffRate:conversations?handoffs.length/conversations*100:0,days,from:from.toISOString(),conversations,leads,orders,handoffs:handoffs.length,bookingRate:conversations?orders/conversations*100:0,leadBookingRate:leads?orders/leads*100:0,totalCost:total,averageCost:costConversations.length?total/costConversations.length:0,invocations:cost._count,toolErrors,models:models.map(m=>({provider:m.provider,model:m.model,count:m._count,cost:Number(m._sum.estimatedCostUsd??0),input:m._sum.inputTokens??0,output:m._sum.outputTokens??0}))};
}

