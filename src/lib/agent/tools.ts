import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type Conversation, type AgentMode } from "@/generated/prisma/client";
import { siteContent } from "@/lib/content";
import { quote, priceSnapshot } from "@/lib/domain/crm-pricing";
import { normalizedPhone, localInput, localInstant } from "@/lib/domain/crm";
import { estimateDuration } from "@/lib/domain/duration";
import { durationConfig, durationData } from "@/lib/services/duration-engine";
import { placesRequest, verifyLocation, normalizeAddress } from "@/lib/services/google-places";
import {plannedEnd} from "@/lib/domain/scheduling-conflicts";
import { findSlots, routingSnapshot } from "@/lib/services/routing-planning";
import { assessScheduling, lockCrew, schedulingLock } from "@/lib/services/scheduling-commands";
import { writeAudit } from "@/lib/services/audit";
import { effectiveMode,assertAutoReady } from './readiness';
import {assertPreviewBatch} from './live-proof';
import {photoQualificationAllowed} from './chat-attachments';
import { orderNotifications, handoffNotification } from './notifications';
import {buildAgentTemporalContext,serviceDatePolicy,latestStartForEndBy,incomingDeparturePolicy,type DepartureLegInput} from "./temporal";
import {applyCustomerFacts,explicitCustomerFacts,supportedFacts} from "./customer-facts";
import {currentClientTurn,pendingHumanStatements,operationalSummary,conversationMemory} from './conversation-memory';
import {inputQuestion,inputAlreadyKnown} from "./chat-presentation";
import {behaviorMetric} from "./behavior-telemetry";
import {bookingReviewBlocked,windowQuantitiesMissing} from './conversion-facts';
import { AgentError, toolSchemas, type AgentState, type BookingRecap, type ToolName, type ToolResult } from "./contracts";

type Tx=Prisma.TransactionClient;
export type ToolContext={conversationId:string;jobId:string;leaseKey:string;revision:number;mode:AgentMode;state:AgentState;handoff?:boolean;factAmounts?:number[];previewTestId?:string; temporal?:ReturnType<typeof buildAgentTemporalContext>; responseText?:string; validatedDepartures?:DepartureLegInput[]};
export const json=(value:unknown)=>JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const stateOf=(c:Pick<Conversation,"state">)=>structuredClone(c.state) as AgentState;
// PostgreSQL jsonb reorders object keys. Hash and compare facts, never their insertion order.
export function canonicalJson(value:unknown):string{return JSON.stringify(value,(_key,v)=>v&&typeof v==="object"&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);}
export function slotFingerprint(state:AgentState){return createHash("sha256").update(canonicalJson({quote:state.quote,address:state.address,duration:state.duration,window:state.requestedWindow,reschedule:state.rescheduleRequested??false})).digest("hex");}
export async function assertToolAccess(tx:Tx,ctx:ToolContext){
  await schedulingLock(tx,"conversation",ctx.conversationId);
  const c=await tx.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}});
  const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:"default"}});
  if(ctx.previewTestId)await assertPreviewBatch(tx,ctx.previewTestId,c.id);
  const mode=ctx.previewTestId&&settings.aiAgentMode!=='OFF'?'AUTO':effectiveMode(settings,c.channel);
  if(c.control!=="AI_CONTROL"||c.revision!==ctx.revision||mode!==ctx.mode||ctx.mode==="OFF")throw new AgentError("AGENT_CONTROL_CHANGED");
  const job=await tx.agentJob.findUnique({where:{id:ctx.jobId}});
  if(!job||job.conversationId!==c.id||job.leaseKey!==ctx.leaseKey||job.status!=="RUNNING"||!job.leaseUntil||job.leaseUntil.getTime()<Date.now())throw new AgentError("JOB_LEASE_LOST");
  return c;
}
async function aiAudit(tx:Tx,ctx:ToolContext,action:string,entityType:string,entityId:string){return writeAudit(tx,{type:"AI",key:`agent:${ctx.jobId}`},{action,entityType,entityId});}
async function activePrice(tx:Tx,state:AgentState,c:Conversation,input:ReturnType<typeof toolSchemas.calculatePrice.parse>){
  const service=await tx.service.findUnique({where:{code:input.service}});
  const scope=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  if(!scope.aiAllowedServices.includes(input.service))throw new AgentError('UNSUPPORTED_SERVICE');
  if(!service?.active)throw new AgentError("SERVICE_UNAVAILABLE");
  const selected=input.extras.filter(e=>e.quantity>0);
  if(await tx.serviceExtra.count({where:{code:{in:selected.map(e=>e.code)},active:true}})!==selected.length)throw new AgentError("EXTRA_UNAVAILABLE");
  const client=c.identityVerified&&c.clientId?await tx.client.findUnique({where:{id:c.clientId},select:{discountPercent:true}}):null;
  const calculated=quote(input.service,input.area,selected,input.urgent),discount=Number(client?.discountPercent??0);
  const snapshot=priceSnapshot(calculated.total,discount,null,null);
  const requiresHumanReview=["HEAVY","EXTREME"].includes(input.soilLevel)||selected.some(e=>e.code==="largeWindow");
  void state;
  return{service,calculated,snapshot,requiresHumanReview};
}
async function updateLead(tx:Tx,c:Conversation,ctx:ToolContext,input:ReturnType<typeof toolSchemas.createOrUpdateLead.parse>){
  if([input.name,input.phone].some(v=>v&&/^(?:не указано|неизвестно|уточняется|unknown|not provided|n\/a|null)$/i.test(v)))return{error:"CONTACT_REQUIRED",message:"Omit missing name/phone entirely. Never send a placeholder. Contact is not required to record cleaning intent or quote."};
  if(input.phone&&!normalizedPhone(input.phone))return{error:"INVALID_PHONE",message:"Ask for a valid customer phone or omit phone. Do not invent contact details."};
  if(input.name&&input.name!==ctx.state.name)delete ctx.state.pending;
  if(input.phone&&input.phone!==ctx.state.phone)delete ctx.state.pending;
  if(input.name)ctx.state.name=input.name;
  if(input.phone)ctx.state.phone=input.phone;
  const serviceCode=input.service??ctx.state.draftFacts?.service;
  const service=serviceCode?await tx.service.findUnique({where:{code:serviceCode},select:{id:true,active:true}}):null;
  if(input.service&&!service?.active)return{error:"SERVICE_UNAVAILABLE"};
  if(ctx.mode==="SHADOW")return{planned:true,operation:"createOrUpdateLead",error:"SHADOW_MUTATION_BLOCKED"};
  const area=input.area??ctx.state.draftFacts?.area;
  const fields={name:ctx.state.name??"Контакт уточняется",phone:ctx.state.phone??"",normalizedPhone:ctx.state.phone?normalizedPhone(ctx.state.phone):null,locale:c.locale,...(service?{serviceId:service.id}:{}),...(area?{area}:{})};
  const previous=c.leadId?await tx.lead.findUnique({where:{id:c.leadId}}):null;
  if(previous?.status==="CONVERTED")return{ok:true,leadId:previous.id};
  const lead=previous?await tx.lead.update({where:{id:previous.id},data:fields}):await tx.lead.create({data:{...fields,submissionId:`agent:${c.id}`,submissionHash:createHash("sha256").update(`agent:${c.id}`).digest("hex"),channel:c.channel,entrySource:"ai-chat",reference:`LC-AI-${randomUUID().slice(0,8).toUpperCase()}`,clientId:c.identityVerified?c.clientId:null,telegramStatus:"CANCELLED"}});
  await tx.conversation.update({where:{id:c.id},data:{leadId:lead.id,stage:"QUALIFYING"}});
  await aiAudit(tx,ctx,previous?"AI_LEAD_UPDATED":"AI_LEAD_CREATED","Lead",lead.id);
  return{ok:true,leadId:lead.id};
}
function recap(state:AgentState,start:string):BookingRecap{
  const q=state.quote!,d=state.duration!,a=state.address!;
  return{service:q.input.service,area:q.input.area,extras:q.input.extras,address:a.fullAddress+(a.apartment?` · ${a.apartment}`:""),start,durationMinutes:d.minutes,price:q.total,currency:"RSD"};
}
async function checkedSlot(tx:Tx,c:Conversation,ctx:ToolContext,token:string){
  const slot=await tx.agentSlot.findFirst({where:{id:token,conversationId:c.id}});
  if(!slot||slot.expiresAt.getTime()<Date.now()||slot.fingerprint!==slotFingerprint(ctx.state))throw new AgentError("SLOT_NO_LONGER_AVAILABLE");
  if(slot.usedAt)return slot;
  const window=ctx.state.requestedWindow!;
  const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  const datePolicy=serviceDatePolicy(window.date,settings);
  if('error' in datePolicy){if(datePolicy.error==='SAME_DAY_CUTOFF')behaviorMetric('sameDayCutoffRejected');throw new AgentError(datePolicy.error!);}
  if(ctx.state.quote?.input.urgent!==datePolicy.urgent)throw new AgentError('URGENT_REPRICE_REQUIRED');
  await lockCrew(tx,slot.cleanerIds);
  const current=await routingSnapshot(tx,window.date);
  if(current.version!==slot.scheduleVersion)throw new AgentError("SLOT_NO_LONGER_AVAILABLE");
  const rules=await tx.durationRule.findUnique({where:{id:ctx.state.duration!.ruleId}});
  if(!rules?.active||rules.version!==ctx.state.duration!.version)throw new AgentError("SLOT_NO_LONGER_AVAILABLE");
  const address=ctx.state.address!;
  if(address.proof)verifyLocation(address.proof);
  const available=await findSlots(tx,{date:window.date,from:window.from,to:window.to,duration:ctx.state.duration!.minutes,requiredCleaners:ctx.state.duration!.requiredCleaners,...(address.addressId?{addressId:address.addressId}:{locationProof:address.proof}),...(ctx.state.rescheduleRequested?{orderId:c.orderId}: {})},{reserveMinutes:ctx.state.duration!.reserve,forceFresh:true,selectedStart:slot.start.toISOString(),selectedCleanerIds:slot.cleanerIds,allowReschedule:!!ctx.state.rescheduleRequested});
  const selected=available.slots.find(s=>s.start===slot.start.toISOString()&&s.cleanerIds.join()===slot.cleanerIds.join());
  if(!selected)throw new AgentError("SLOT_NO_LONGER_AVAILABLE");
  ctx.validatedDepartures=selected.legs.filter(leg=>leg.orderId===(ctx.state.rescheduleRequested?c.orderId:'new-order')).map(leg=>{
    const previous=leg.previousId?current.orders.find(order=>order.id===leg.previousId):undefined;
    return{departure:leg.recommendedDeparture,start:selected.start,travelSeconds:leg.route.durationSeconds!,bufferMinutes:leg.bufferMinutes,previous:previous?{status:previous.status,end:plannedEnd(previous)?.toISOString()??null}:undefined};
  });
  return slot;
}
/** Atomic standard booking boundary; shares production pricing, duration and scheduling services. */
export async function bookConfirmed(tx:Tx,c:Conversation,ctx:ToolContext,reschedule:boolean){
  if(ctx.mode!=="AUTO")return{error:"SHADOW_MUTATION_BLOCKED",planned:true,operation:reschedule?"rescheduleOrder":"createOrder"};
  if(bookingReviewBlocked(ctx.state)||await tx.humanHandoff.count({where:{conversationId:c.id,resolvedAt:null,reason:{not:'SOFT:CONTACT_PREFERENCE'}}}))return{error:'REVIEW_REQUIRED',message:'Owner must resolve pending review before booking.'};
  const state=ctx.state,pending=state.pending;
  if(!pending){if(state.booking&&!reschedule)return{booked:true,reference:state.booking.reference,recap:state.booking};throw new AgentError("EXPLICIT_CONFIRMATION_REQUIRED");}
  if(!pending.confirmedByMessageId||pending.reschedule!==reschedule)throw new AgentError("EXPLICIT_CONFIRMATION_REQUIRED");
  const confirmation=await tx.message.findFirst({where:{id:pending.confirmedByMessageId,conversationId:c.id,author:"CLIENT"}});
  if(!confirmation)throw new AgentError("EXPLICIT_CONFIRMATION_REQUIRED");
  const slot=await checkedSlot(tx,c,ctx,pending.slotToken);
  if(slot.usedAt&&slot.result)return slot.result as ToolResult;
  if(!state.quote||state.quote.requiresHumanReview||Date.now()-Date.parse(state.quote.at)>30*60000||!state.duration||!state.address||!state.name||!state.phone||!normalizedPhone(state.phone))throw new AgentError("INCOMPLETE_BOOKING");
  if(canonicalJson(recap(state,slot.start.toISOString()))!==canonicalJson(pending.recap))throw new AgentError("EXPLICIT_CONFIRMATION_REQUIRED");
  const pricing=await activePrice(tx,state,c,state.quote.input);
  if(pricing.requiresHumanReview||pricing.snapshot.finalPrice!==state.quote.total)throw new AgentError("PRICE_CHANGED");
  const duration=await durationData(tx,{...state.quote.input,serviceId:pricing.service.id,requiredCleaners:state.duration.requiredCleaners});
  if(duration.estimatedDurationMinutes!==state.duration.minutes||duration.durationRuleVersion!==state.duration.version)throw new AgentError("SLOT_NO_LONGER_AVAILABLE");
  // Serialize the side-effect boundary with emergency OFF/SHADOW and re-read control after all checks.
  await schedulingLock(tx,'settings','ai');
  await assertToolAccess(tx,ctx);
  if(!ctx.previewTestId)await assertAutoReady(tx);
  let client=c.identityVerified&&c.clientId?await tx.client.findUniqueOrThrow({where:{id:c.clientId}}):null;
  if(!client){
    const phone=normalizedPhone(state.phone)!;
    await schedulingLock(tx,"phone",phone);
    // A matching phone is a claim, not proof. Never merge into a stranger's CRM identity.
    if(await tx.client.count({where:{normalizedPhone:phone}}))throw new AgentError("IDENTITY_REQUIRED");
    client=await tx.client.create({data:{name:state.name,phone:state.phone,normalizedPhone:phone,preferredChannel:c.channel}});
    await aiAudit(tx,ctx,"AI_CLIENT_CREATED","Client",client.id);
  }
  let addressId=state.address.addressId;
  if(addressId){
    if(!c.identityVerified||await tx.clientAddress.count({where:{id:addressId,clientId:client.id,active:true}})!==1)throw new AgentError("IDENTITY_REQUIRED");
  }else{
    if(!state.address.proof)throw new AgentError("ROUTING_UNRELIABLE");
    const address=await tx.clientAddress.create({data:{...normalizeAddress({fullAddress:state.address.fullAddress,locationProof:state.address.proof}),apartment:state.address.apartment,clientId:client.id}});addressId=address.id;
    await aiAudit(tx,ctx,"AI_ADDRESS_CREATED","Client",client.id);
  }
  const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:"default"}});
  const finalDatePolicy=serviceDatePolicy(state.requestedWindow!.date,settings);
  if('error' in finalDatePolicy)throw new AgentError(finalDatePolicy.error!);
  if(finalDatePolicy.urgent!==state.quote.input.urgent)throw new AgentError('URGENT_REPRICE_REQUIRED');
  const data={...duration,...pricing.snapshot,serviceId:pricing.service.id,area:state.quote.input.area,soilLevel:state.quote.input.soilLevel,urgent:state.quote.input.urgent,requiredCleaners:state.duration.requiredCleaners,scheduleMode:"FIXED" as const,scheduledStart:slot.start,windowFrom:null,windowTo:null,addressId,travelBufferMinutes:settings.defaultTravelBufferMinutes,currency:"RSD",manualDurationMinutes:null};
  const checkBoundary=()=>{
    const policy=serviceDatePolicy(state.requestedWindow!.date,settings);
    if('error' in policy)throw new AgentError(policy.error!);
    if(policy.urgent!==state.quote!.input.urgent)throw new AgentError('URGENT_REPRICE_REQUIRED');
    if(ctx.validatedDepartures?.length!==slot.cleanerIds.length)throw new AgentError('DEPARTURE_UNVERIFIED');
    for(const leg of ctx.validatedDepartures){const result=incomingDeparturePolicy(leg,state.requestedWindow!.date,settings);if('error' in result){if(result.error==='PAST_DEPARTURE')behaviorMetric('pastDepartureRejected');throw new AgentError(result.error!);}}
  };
  let order;
  if(reschedule){
    if(!c.orderId||!c.identityVerified||!state.rescheduleRequested)throw new AgentError("IDENTITY_REQUIRED");
    await schedulingLock(tx,"order",c.orderId);
    const previous=await tx.order.findFirst({where:{id:c.orderId,clientId:client.id,status:{in:["CONFIRMED","SCHEDULED"]}},include:{assignments:{where:{removedAt:null}}}});
    if(!previous||previous.serviceId!==pricing.service.id||Number(previous.finalPrice)!==state.quote.total||previous.addressId!==addressId)throw new AgentError("RESCHEDULE_REVIEW_REQUIRED");
    await lockCrew(tx,previous.assignments.map(a=>a.cleanerId));
    checkBoundary();
    order=await tx.order.update({where:{id:previous.id},data});
    await tx.orderCleaner.updateMany({where:{orderId:order.id,removedAt:null},data:{removedAt:new Date()}});
  }else{
    if(c.orderId)throw new AgentError("ORDER_ALREADY_EXISTS");
    const catalogue=await tx.serviceExtra.findMany({where:{code:{in:state.quote.input.extras.map(e=>e.code)},active:true}});
    checkBoundary();
    order=await tx.order.create({data:{...data,requestId:`agent:${slot.id}`,reference:`ORD-AI-${randomUUID().slice(0,8).toUpperCase()}`,clientId:client.id,leadId:c.leadId,status:"CONFIRMED",source:c.channel,extras:{create:pricing.calculated.extras.map(e=>({extraId:catalogue.find(x=>x.code===e.code)!.id,quantity:e.quantity,unitPrice:e.unitPrice}))}}});
  }
  // No AI override is possible, including warnings. Cache must still be fresh and verified.
  if((await assessScheduling(tx,{...order,cleanerIds:slot.cleanerIds},true)).length)throw new AgentError("SLOT_NO_LONGER_AVAILABLE");
  for(const cleanerId of slot.cleanerIds)await tx.orderCleaner.upsert({where:{orderId_cleanerId:{orderId:order.id,cleanerId}},create:{orderId:order.id,cleanerId},update:{removedAt:null,assignedAt:new Date()}});
  if(c.leadId){await tx.lead.update({where:{id:c.leadId},data:{status:"CONVERTED",clientId:client.id}});await aiAudit(tx,ctx,"AI_LEAD_CONVERTED","Lead",c.leadId);}
  const booking={...pending.recap,reference:order.reference??order.id,orderId:order.id};
  state.booking=booking;delete state.pending;delete state.rescheduleRequested;
  await tx.conversation.update({where:{id:c.id},data:{clientId:client.id,identityVerified:true,orderId:order.id,stage:"BOOKED",needsAttention:true}});
  const result={booked:true,reference:booking.reference,recap:pending.recap};
  await tx.agentSlot.update({where:{id:slot.id},data:{usedAt:new Date(),result:json(result)}});
  await aiAudit(tx,ctx,reschedule?"AI_ORDER_RESCHEDULED":"AI_ORDER_CREATED","Order",order.id);
  if(!ctx.previewTestId)await orderNotifications(tx,order.id,reschedule?'CHANGED':'BOOKED',`agent:${slot.id}`,c.id,true);
  return result;
}
async function dispatch(tx:Tx,c:Conversation,ctx:ToolContext,name:ToolName,payload:unknown):Promise<ToolResult>{
  const state=ctx.state;
  if(name==="getBusinessInfo"){
    const content=siteContent[c.locale.startsWith("sr")?"sr":c.locale==="en"?"en":"ru"];
    const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const facts={sameDayPolicy:{cutoffMinute:settings.sameDayBookingCutoffMinute,latestDepartureMinute:settings.latestCleanerDepartureMinute,timezone:settings.timezone,requiresRealAvailability:true,surchargePercent:20},city:content.footer.location,services:content.services,scope:content.comparison,assurance:content.assurance,faq:content.faq.items,extras:content.calculator.labels,pricingPolicy:content.calculator.note};
    ctx.factAmounts=[...JSON.stringify(facts).matchAll(/(\d[\d\s,]*?)\s*RSD/gi)].map(m=>Number(m[1].replace(/[\s,]/g,"")));
    return facts;
  }
  if(name==="findClient"){
    if(!c.identityVerified||!c.clientId)return{verified:false,error:"IDENTITY_REQUIRED"};
    const client=await tx.client.findUnique({where:{id:c.clientId},select:{name:true,discountPercent:true,orders:{where:{historical:false},take:3,orderBy:{createdAt:"desc"},select:{service:{select:{code:true}}}}}});
    const currentOrder=c.orderId?await tx.order.findFirst({where:{id:c.orderId,clientId:c.clientId},select:{service:{select:{code:true}},area:true,soilLevel:true,urgent:true,status:true,scheduledStart:true,finalPrice:true,extras:{select:{quantity:true,extra:{select:{code:true}}}}}}):null;
    return{verified:true,name:client?.name,discountPercent:Number(client?.discountPercent??0),pastServices:client?.orders.flatMap(o=>o.service ? [o.service.code] : []),currentOrder:currentOrder?.service?{service:currentOrder.service.code,area:Number(currentOrder.area),soilLevel:currentOrder.soilLevel,urgent:currentOrder.urgent,status:currentOrder.status,start:currentOrder.scheduledStart,total:Number(currentOrder.finalPrice),extras:currentOrder.extras.map(e=>({code:e.extra.code,quantity:e.quantity}))}:null};
  }
  if(name==='recordCustomerFacts'){
    const input=toolSchemas.recordCustomerFacts.parse(payload);
    const job=await tx.agentJob.findUniqueOrThrow({where:{id:ctx.jobId}});
    const turn=await currentClientTurn(tx,c.id,job.messageId);
    const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const source=turn.find(m=>m.text.includes(input.evidence)&&supportedFacts(input.facts,explicitCustomerFacts(m.text,m.sentAt,settings.timezone,(m.structured as {inputIntent?:AgentState['nextInput']}|null)?.inputIntent,state)));
    if(!source)return{error:'CUSTOMER_FACTS_REQUIRED'};
    applyCustomerFacts(state,input.facts,buildAgentTemporalContext(source.sentAt,settings).nowLocalDate);
    // Evidence from an early message cannot undo a later explicit correction in this same burst.
    for(const m of turn.slice(turn.indexOf(source)+1))applyCustomerFacts(state,explicitCustomerFacts(m.text,m.sentAt,settings.timezone,(m.structured as {inputIntent?:AgentState['nextInput']}|null)?.inputIntent,state));
    return{facts:state.draftFacts};
  }
  if(name==='reconcileHumanContext'){
    const input=toolSchemas.reconcileHumanContext.parse(payload),pending=pendingHumanStatements(c.summary);
    const memory=conversationMemory(c.summary),pendingIds=pending.map(s=>s.id),submitted=[...new Set(input.reviewedMessageIds)];
    if(!pending.length)return{facts:state.draftFacts,reviewed:true};
    // Providers may echo retained, already reviewed notes as well. Accept those IDs,
    // but require every pending note and reject IDs outside this conversation memory.
    if(pending.some(s=>!submitted.includes(s.id))||submitted.some(id=>!pendingIds.includes(id)&&!memory.reviewedHumanIds.includes(id)))return{error:'HUMAN_CONTEXT_REQUIRED',pendingMessageIds:pendingIds,message:'Review every pending ID listed here. Previously reviewed IDs need no correction.'};
    const ids=pendingIds;
    if(input.corrections.some(p=>!memory.reviewedHumanIds.includes(p.messageId)&&!pending.some(s=>s.id===p.messageId&&s.text.includes(p.evidence))))return{error:'HUMAN_CONTEXT_REQUIRED',pendingMessageIds:pendingIds,statements:pending,message:'Each new correction must reference a pending ID and an exact excerpt of its statement; combine factual fields or submit separate corrections for the same statement. Already reviewed corrections are ignored.'};
    const rows=await tx.message.findMany({where:{conversationId:c.id,OR:[{id:{in:ids}},{author:'CLIENT',sentAt:{gte:(await tx.message.findFirstOrThrow({where:{id:{in:ids}},orderBy:[{sentAt:'asc'},{id:'asc'}]})).sentAt}}]},orderBy:[{sentAt:'asc'},{id:'asc'}]});
    const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const edits=conversationMemory(c.summary).factEdits??[];
    const timeline=[...rows.map(m=>({at:m.sentAt,id:m.id,message:m,facts:undefined as AgentState['draftFacts']})),...edits.filter(edit=>new Date(edit.at)>=rows[0].sentAt).map(edit=>({at:new Date(edit.at),id:'',message:undefined,facts:edit.facts}))].sort((a,b)=>a.at.getTime()-b.at.getTime()||a.id.localeCompare(b.id));
    for(const event of timeline){
      if(event.facts){applyCustomerFacts(state,event.facts);continue;}
      const m=event.message!;
      if(m.author==='ADMIN'){for(const correction of input.corrections.filter(p=>p.messageId===m.id))applyCustomerFacts(state,correction.facts);}
      else if(m.author==='CLIENT')applyCustomerFacts(state,explicitCustomerFacts(m.text,m.sentAt,settings.timezone,(m.structured as {inputIntent?:AgentState['nextInput']}|null)?.inputIntent,state));
    }
    if(ctx.mode==='AUTO'&&(c.leadId||state.draftFacts?.service&&state.draftFacts.area))await updateLead(tx,c,ctx,{intent:'cleaning'});
    if(ctx.mode==='AUTO')await tx.conversation.update({where:{id:c.id},data:{summary:operationalSummary(state,c.summary,{reviewedHumanIds:ids})}});
    return{facts:state.draftFacts};
  }
  if(name==='requestCustomerInput'){
    const {intent}=toolSchemas.requestCustomerInput.parse(payload);
    if(inputAlreadyKnown(intent,state)){behaviorMetric('repeatedQuestionDetected');behaviorMetric('repeatedQualificationQuestionCount');return{error:'FACT_ALREADY_KNOWN',facts:state.draftFacts};}
    if(intent==='SLOT_SELECTION'&&!state.slots?.length)return{error:'SLOTS_REQUIRED'};
    if(intent==='POST_BOOKING'&&!state.booking||intent==='BOOKING_CONFIRMATION'&&!state.pending||intent==='YES_NO'&&!state.quote)return{error:'INPUT_CONTEXT_REQUIRED'};
    let question=inputQuestion(intent,c.locale);
    if(intent==='SERVICE_CONFIRMATION'){
      if(state.draftFacts?.service!=='deep')question=inputQuestion('SERVICE_TYPE',c.locale);
      const content=siteContent[c.locale.startsWith('sr')?'sr':c.locale==='en'?'en':'ru'];
      const exclusions=c.locale.startsWith('sr')?'Pranje kreveta i tepiha nije deo generalnog čišćenja stana.':c.locale==='en'?'Washing beds and carpets is not part of apartment deep cleaning.':'Химчистка кроватей и ковров не входит в генеральную уборку квартиры.';
      question=content.services.filter(s=>s.id==='regular'||s.id==='deep').map(s=>s.name+': '+s.description).join('\n')+'\n'+exclusions+'\n\n'+question;
    }
    if(!question)return{error:'UNSUPPORTED_INPUT_INTENT'};
    state.nextInput=intent;ctx.responseText=question;
    return{question,intent,finishTurn:true};
  }
  if(name==="createOrUpdateLead")return updateLead(tx,c,ctx,toolSchemas[name].parse(payload));
  if(name==="calculatePrice"){
    const input=toolSchemas[name].parse(payload);
    const facts=state.draftFacts;
    if(facts?.serviceConfirmationRequired)return{error:'SERVICE_CONFIRMATION_REQUIRED'};
    if(windowQuantitiesMissing(facts))return{error:'WINDOW_QUANTITIES_REQUIRED'};
    if(!ctx.previewTestId&&!state.quote&&(!facts?.service||!facts.area||!facts.soilLevel||!facts.extrasConfirmed))return{error:'CUSTOMER_FACTS_REQUIRED',facts,message:'Need explicitly confirmed service, area, soil and extras. Ask only for missing facts.'};
    if(facts&&['service','area','soilLevel','extras'].some(key=>facts[key as keyof typeof facts]!==undefined&&canonicalJson(facts[key as keyof typeof facts])!==canonicalJson(input[key as keyof typeof input])))return{error:'CUSTOMER_CORRECTION_REQUIRES_CURRENT_FACTS',facts};
    const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const date=facts?.requestedDate??state.requestedWindow?.date;
    if(date){const policy=serviceDatePolicy(date,settings);if('error' in policy){if(policy.error==='SAME_DAY_CUTOFF')behaviorMetric('sameDayCutoffRejected');return policy;}input.urgent=policy.urgent;}
    else input.urgent=false;
    if(!await photoQualificationAllowed(tx,c.id,input))return{error:'CUSTOMER_FACTS_REQUIRED',message:'Photos cannot supply floor area or dirt category. Ask the customer to confirm the area and dirt level in text before calculating a price.'};
    const pricing=await activePrice(tx,state,c,input);
    state.qualification=input;
    state.draftFacts={...state.draftFacts,service:input.service,area:input.area,soilLevel:input.soilLevel,extras:input.extras,extrasConfirmed:true};
    const pendingReviewItems=[...new Set([...(facts?.reviewItems??[]),...(pricing.requiresHumanReview?['PRICE_REVIEW']:[]),...(state.review?.reasons??[]).filter(r=>r!=='CONTACT_PREFERENCE')])];
    state.quote={id:randomUUID(),serviceId:pricing.service.id,input,total:pricing.snapshot.finalPrice,base:pricing.calculated.base,discountPercent:pricing.snapshot.discountPercent,requiresHumanReview:pricing.requiresHumanReview,at:new Date().toISOString(),breakdown:pricing.calculated.extras.map(e=>({...e,amount:e.quantity*e.unitPrice})),pendingReviewItems};
    delete state.duration;delete state.slots;delete state.selectedSlotToken;delete state.pending;
    if(ctx.mode==="AUTO"&&c.leadId)await tx.lead.update({where:{id:c.leadId},data:{area:input.area,serviceId:pricing.service.id,urgent:input.urgent,estimatedPrice:state.quote.total}});
    if(ctx.mode==="AUTO")await aiAudit(tx,ctx,"AI_QUOTE_GENERATED","Conversation",c.id);
    return{quoteId:state.quote.id,base:pricing.calculated.base,extras:state.quote.breakdown,total:state.quote.total,knownSubtotal:state.quote.total,pendingReviewItems,final:!pendingReviewItems.length,currency:"RSD",discountPercent:state.quote.discountPercent,requiresHumanReview:pricing.requiresHumanReview||!!facts?.reviewItems?.length,estimate:true};
  }
  if(name==="estimateDuration"){
    if(!state.quote)return{error:"QUOTE_REQUIRED"};
    const rules=await tx.durationRule.findMany({where:{serviceId:state.quote.serviceId,active:true},orderBy:{cleanerCount:"asc"}});
    let result:ReturnType<typeof estimateDuration>=null,crew=0;
    for(const count of [...new Set(rules.map(r=>r.cleanerCount))]){
      result=estimateDuration({...state.quote.input,serviceId:state.quote.serviceId,requiredCleaners:count},rules.map(durationConfig),{showPartial:true});if(result){crew=count;break;}
    }
    if(!result)return{error:"NO_DURATION_RULE",confidence:'UNCONFIGURED',requiresHumanReview:true};
    if(!result.schedulingAllowed)return{error:'NO_DURATION_RULE',confidence:'PARTIALLY_CONFIGURED',unknownExtras:result.unknownExtras,requiresHumanReview:true};
    state.duration={minutes:result.estimatedDurationMinutes,reserve:result.cleaningReserveMinutes,requiredCleaners:crew,ruleId:result.ruleId,version:result.version};
    return{minutes:result.estimatedDurationMinutes,requiredCleaners:crew,estimate:true,confidence:result.confidence,unknownExtras:result.unknownExtras,schedulingReserveMinutes:result.cleaningReserveMinutes};
  }
  if(name==="resolveAddress"){
    const input=toolSchemas[name].parse(payload),sessionToken=randomUUID();
    if(!input.placeId&&state.address&&input.query!==state.address.fullAddress){delete state.address;delete state.addressCandidates;delete state.pending;delete state.slots;delete state.selectedSlotToken;}
    if(input.placeId&&!state.addressCandidates?.some(a=>a.placeId===input.placeId))return{error:"ADDRESS_SELECTION_REQUIRED"};
    const result=await placesRequest(input.placeId?"place":"autocomplete",{query:state.addressCandidates?.find(a=>a.placeId===input.placeId)?.query??input.query,placeId:input.placeId,sessionToken});
    if(!result.available)return{error:"ROUTING_UNRELIABLE"};
    if("proof" in result&&result.proof&&result.address){state.address={fullAddress:result.address,proof:result.proof,apartment:input.apartment};delete state.pending;delete state.slots;delete state.selectedSlotToken;return{verified:true,address:result.address};}
    if("suggestions" in result){state.addressCandidates=(result.suggestions as {placeId:string;text:string}[]).map(a=>({...a,query:input.query}));return{candidates:state.addressCandidates,needsSelection:true};}
    return{error:"AMBIGUOUS"};
  }
  if(name==="getClientAddresses"){
    if(!c.identityVerified||!c.clientId)return{error:"IDENTITY_REQUIRED"};
    const input=toolSchemas[name].parse(payload);
    const addresses=await tx.clientAddress.findMany({where:{clientId:c.clientId,active:true},select:{id:true,fullAddress:true,latitude:true,longitude:true,placeId:true,coordinatesConfirmed:true},take:10});
    if(input.addressId){const selected=addresses.find(a=>a.id===input.addressId);if(!selected)return{error:"IDENTITY_REQUIRED"};if(selected.latitude===null||selected.longitude===null||!selected.coordinatesConfirmed)return{error:"ROUTING_UNRELIABLE"};state.address={fullAddress:selected.fullAddress,addressId:selected.id};delete state.pending;delete state.slots;delete state.selectedSlotToken;}
    return{addresses:addresses.map(a=>({addressId:a.id,address:a.fullAddress}))};
  }
  if(name==="findAvailableSlots"){
    const window=toolSchemas.findAvailableSlots.parse(payload);
    if(state.timeClarificationRequired)return{error:'TIME_WINDOW_REQUIRED',message:'Ask for an explicit clock time or range. Morning/afternoon/evening/at two have no configured automatic mapping.'};
    const settings=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const policy=serviceDatePolicy(window.date,settings);
    if('error' in policy){if(policy.error==='SAME_DAY_CUTOFF')behaviorMetric('sameDayCutoffRejected');return{...policy,slots:[]};}
    if(!ctx.previewTestId&&!state.draftFacts?.requestedDate&&!state.requestedWindow)return{error:'DATE_REQUIRED',message:'Ask for an explicit service date. Do not choose a date yourself.'};
    if(state.draftFacts?.requestedDate&&window.date!==state.draftFacts.requestedDate)return{error:'CUSTOMER_DATE_MISMATCH',date:state.draftFacts.requestedDate};
    if(state.quote&&state.quote.input.urgent!==policy.urgent){
      const input={...state.quote.input,urgent:policy.urgent},pricing=await activePrice(tx,state,c,input);
      state.quote={...state.quote,id:randomUUID(),input,total:pricing.snapshot.finalPrice,base:pricing.calculated.base,at:new Date().toISOString()};state.qualification=input;delete state.slots;delete state.selectedSlotToken;delete state.pending;
      state.nextInput='YES_NO';
      if(ctx.mode==='AUTO'&&c.leadId)await tx.lead.update({where:{id:c.leadId},data:{urgent:input.urgent,estimatedPrice:state.quote.total}});
      ctx.responseText=c.locale==='ru'?`На выбранную дату цена составит ${state.quote.total} RSD${input.urgent?' с доплатой 20% за сегодня':''}. Проверить свободное время?`:c.locale==='en'?`The price for that date is ${state.quote.total} RSD${input.urgent?' including the 20% same-day surcharge':''}. Shall I check availability?`:c.locale==='sr-Cyrl'?`Цена за тај датум је ${state.quote.total} RSD${input.urgent?' са доплатом 20% за данас':''}. Да проверим термине?`:`Cena za taj datum je ${state.quote.total} RSD${input.urgent?' sa doplatom 20% za danas':''}. Da proverim termine?`;
      return{error:'URGENT_REPRICE_REQUIRED',quote:state.quote,message:'Present the corrected server price to the customer before offering slots; call slot search again only after presenting it.'};
    }
    if(!state.quote||state.quote.requiresHumanReview)return{error:"PRICE_REVIEW"};
    if(!state.duration)return{error:"NO_DURATION_RULE"};
    if(!state.address?.proof&&!state.address?.addressId)return{error:"ADDRESS_REQUIRED"};
    if(c.orderId&&!state.rescheduleRequested)return{error:"RESCHEDULE_REQUEST_REQUIRED"};
    if(state.rescheduleRequested&&(!c.identityVerified||!c.orderId))return{error:"IDENTITY_REQUIRED"};
    const latestStart=window.timeIntent==='END_BY'?latestStartForEndBy(window.to,state.duration.minutes+state.duration.reserve,settings.timezone):undefined;
    if(window.timeIntent==='END_BY')window.to=latestStartForEndBy(window.to,state.duration.reserve,settings.timezone);
    if(window.timeIntent==='ARRIVE_BY')window.to=latestStartForEndBy(window.to,-state.duration.minutes,settings.timezone);
    const rawFrom=localInstant(window.from),to=localInstant(window.to),from=new Date(Math.max(rawFrom.getTime(),Date.now()));
    if(window.timeIntent==='START_AT'&&rawFrom.getTime()<Date.now())return{error:'PAST_START_TIME'};
    window.from=localInput(from);
    if(rawFrom.getTime()>Date.now()+90*86400000||to<=from) return{error:"INVALID_DATE_WINDOW"};
    state.requestedWindow=window;delete state.pending;
    const snapshot=await routingSnapshot(tx,window.date);
    const result=await findSlots(tx,{date:window.date,from:window.from,to:window.to,duration:state.duration.minutes,requiredCleaners:state.duration.requiredCleaners,...(state.address.addressId?{addressId:state.address.addressId}:{locationProof:state.address.proof}),...(state.rescheduleRequested?{orderId:c.orderId}:{})},{reserveMinutes:state.duration.reserve,allowReschedule:!!state.rescheduleRequested,...(window.timeIntent==='START_AT'?{selectedStart:rawFrom.toISOString()}:{})});
    if('error' in result&&result.error)return{error:result.error,slots:[]};
    if(!result.slots.length)return{error:"NO_SLOTS",slots:[],requiresHumanReview:true};
    state.slots=[];delete state.selectedSlotToken;
    for(const s of result.slots.slice(0,3)){
      const token=randomUUID();
      if(ctx.mode==="AUTO")await tx.agentSlot.create({data:{id:token,conversationId:c.id,fingerprint:slotFingerprint(state),scheduleVersion:snapshot.version,start:s.start,durationMinutes:state.duration.minutes,requiredCleaners:state.duration.requiredCleaners,cleanerIds:s.cleanerIds,routingSnapshot:json(s.legs.map(l=>({cleanerId:l.cleanerId,status:l.route.status,expiresAt:l.route.expiresAt}))),expiresAt:new Date(Date.now()+10*60000)}});
      state.slots.push({token,start:s.start,duration:state.duration.minutes});
    }
    if(ctx.mode==="AUTO")await aiAudit(tx,ctx,"AI_SLOTS_PROPOSED","Conversation",c.id);
    return{...(latestStart?{latestStart}:{}),slots:state.slots.map(s=>({slotToken:s.token,start:localInput(new Date(s.start)),durationMinutes:s.duration})),...(ctx.mode==="SHADOW"?{proposalOnly:true}: {})};
  }
  if(name==="validateSlot"){
    const input=toolSchemas[name].parse(payload);
    if(state.selectedSlotToken&&input.slotToken!==state.selectedSlotToken)return{error:'STALE_SLOT'};
    if(!state.name||!state.phone||!normalizedPhone(state.phone))return{error:"CONTACT_REQUIRED"};
    if(ctx.mode==="SHADOW")return{planned:true,error:"SHADOW_MUTATION_BLOCKED",operation:"validateSlot"};
    const slot=await checkedSlot(tx,c,ctx,input.slotToken);
    if(slot.usedAt)return{error:"SLOT_NO_LONGER_AVAILABLE"};
    state.pending={slotToken:slot.id,nonce:randomUUID(),recap:recap(state,slot.start.toISOString()),reschedule:state.rescheduleRequested??false};
    await tx.conversation.update({where:{id:c.id},data:{stage:"AWAITING_CONFIRMATION"}});
    return{recap:state.pending.recap,requiresExplicitConfirmation:true};
  }
  if(name==="createOrder"||name==="rescheduleOrder")return bookConfirmed(tx,c,ctx,name==="rescheduleOrder");
  if(name==='requestReview'){
    const {reason}=toolSchemas.requestReview.parse(payload);
    if(ctx.mode==='SHADOW')return{planned:true,error:'SHADOW_MUTATION_BLOCKED',reason};
    state.review={reasons:[...new Set([...(state.review?.reasons??[]),reason])]};
    delete state.pending;
    const existing=await tx.humanHandoff.findFirst({where:{conversationId:c.id,resolvedAt:null,reason:'SOFT:'+reason}});
    const review=existing??await tx.humanHandoff.create({data:{conversationId:c.id,reason:'SOFT:'+reason}});
    await tx.conversation.update({where:{id:c.id},data:{needsAttention:true,state:json(state)}});
    if(!existing){await aiAudit(tx,ctx,'AI_REVIEW_REQUESTED','HumanHandoff',review.id);await handoffNotification(tx,c.id,review.id,'SOFT:'+reason);}
    return{reviewRequired:true,continuesIntake:true,reason,bookingBlocked:reason!=='CONTACT_PREFERENCE'};
  }
  const input=toolSchemas.requestHumanHandoff.parse(payload);
  if(['AMBIGUOUS','PRICE_REVIEW','NO_DURATION_RULE','NO_SLOTS','ROUTING_UNRELIABLE'].includes(input.reason)&&!['HEAVY','EXTREME'].includes(state.draftFacts?.soilLevel??'')){
    return dispatch(tx,c,ctx,'requestReview',{reason:input.reason==='NO_DURATION_RULE'?'NO_DURATION_RULE':input.reason==='NO_SLOTS'?'NO_SLOTS':input.reason==='ROUTING_UNRELIABLE'?'ROUTING_UNRELIABLE':'OPERATIONAL'});
  }
  ctx.handoff=true;
  delete state.nextInput;delete state.pending;
  // Returning control or replying resolves the notification, not the underlying booking restriction.
  if(input.reason!=='CLIENT_REQUEST')state.review={reasons:[...new Set([...state.review?.reasons??[],`HARD:${input.reason}`])]};
  behaviorMetric('handoffByReason',input.reason);
  if(!state.draftFacts?.service||!state.draftFacts?.area||!state.draftFacts?.soilLevel||!state.draftFacts?.extrasConfirmed)behaviorMetric('handoffBeforeQualificationComplete',input.reason);
  if(ctx.mode==="SHADOW")return{planned:true,error:"SHADOW_MUTATION_BLOCKED",reason:input.reason};
  const existing=await tx.humanHandoff.findFirst({where:{conversationId:c.id,resolvedAt:null,reason:input.reason}});
  const handoff=existing??await tx.humanHandoff.create({data:{conversationId:c.id,reason:input.reason}});
  await tx.conversation.update({where:{id:c.id},data:{control:"HUMAN_CONTROL",stage:"HANDOFF",needsAttention:true,shadowProposal:Prisma.DbNull}});
  if(!existing)await aiAudit(tx,ctx,"AI_HANDOFF_REQUESTED","HumanHandoff",handoff.id);
  await handoffNotification(tx,c.id,handoff.id,input.reason);
  return{handoff:true,reason:input.reason};
}
export async function executeAgentTool(db:PrismaClient,ctx:ToolContext,name:string,args:unknown):Promise<ToolResult>{
  const started=Date.now();
  if(!Object.hasOwn(toolSchemas,name)){
    await db.$transaction(async tx=>{await assertToolAccess(tx,ctx);await tx.agentToolTrace.create({data:{conversationId:ctx.conversationId,jobId:ctx.jobId,tool:"UNSUPPORTED",outcome:"TOOL_NOT_ALLOWED",latencyMs:Date.now()-started,shadow:ctx.mode==="SHADOW"}});});
    return{error:"TOOL_NOT_ALLOWED"};
  }
  const typed=name as ToolName;
  const parsed=toolSchemas[typed].safeParse(args);
  if(!parsed.success){
    await db.$transaction(async tx=>{await assertToolAccess(tx,ctx);await tx.agentToolTrace.create({data:{conversationId:ctx.conversationId,jobId:ctx.jobId,tool:typed,outcome:"INVALID_TOOL_ARGUMENTS",latencyMs:Date.now()-started,shadow:ctx.mode==="SHADOW"}});});
    return{error:"INVALID_TOOL_ARGUMENTS",fields:parsed.error.issues.map(i=>({path:i.path.join("."),code:i.code,message:i.message.slice(0,240)})),message:"Correct these fields using the tool schema. Omit unknown optional fields entirely; never use placeholders."};
  }
  let result:ToolResult;
  try{
    result=await db.$transaction(async tx=>{
      const c=await assertToolAccess(tx,ctx);
      if(ctx.mode==="AUTO")ctx.state=stateOf(c);
      if(pendingHumanStatements(c.summary).length&&!['getBusinessInfo','recordCustomerFacts','reconcileHumanContext','requestHumanHandoff','requestReview'].includes(typed))return{error:'HUMAN_CONTEXT_REQUIRED'};
      const output=await dispatch(tx,c,ctx,typed,parsed.data);
      if(ctx.mode==="AUTO"){
        const live=await tx.conversation.findUniqueOrThrow({where:{id:c.id}});
        await tx.conversation.update({where:{id:c.id},data:{summary:operationalSummary(ctx.state,live.summary),state:json(ctx.state),...(typed==="calculatePrice"?{stage:"QUOTING"}:typed==="findAvailableSlots"&&!output.error?{stage:"SCHEDULING"}:{})}});
      }
      return output;
    },{maxWait:10000,timeout:40000});
  }catch(e){
    if(e instanceof AgentError&&["AGENT_CONTROL_CHANGED","JOB_LEASE_LOST"].includes(e.code))throw e;
    if(e instanceof AgentError)result={error:e.code};
    else{
      // Unknown commit outcome: stop this turn. A leased retry reconciles durable slot/order IDs first.
      throw new AgentError("TOOL_EXECUTION_UNCERTAIN");
    }
  }
  await db.agentToolTrace.create({data:{conversationId:ctx.conversationId,jobId:ctx.jobId,tool:typed,outcome:typeof result.error==="string"?result.error:"OK",entityId:typeof result.leadId==="string"?result.leadId:null,latencyMs:Date.now()-started,shadow:ctx.mode==="SHADOW"}});
  return result;
}
