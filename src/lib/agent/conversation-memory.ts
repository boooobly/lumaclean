import type {Prisma, Message} from '@/generated/prisma/client';
import type {AgentState} from './contracts';
type HumanStatement={id:string;text:string};
type FactEdit={at:string;facts:NonNullable<AgentState['draftFacts']>};
type Memory={version:1;humanStatements:HumanStatement[];reviewedHumanIds:string[];factEdits?:FactEdit[];lifecycle?:string};
export function conversationMemory(summary:string|null):Memory{
  try{const m=JSON.parse(summary??'{}');if(m.version===1&&Array.isArray(m.humanStatements)&&Array.isArray(m.reviewedHumanIds))return m;}catch{}
  return{version:1,humanStatements:[],reviewedHumanIds:[]};
}
export function pendingHumanStatements(summary:string|null){const m=conversationMemory(summary);return m.humanStatements.filter(s=>!m.reviewedHumanIds.includes(s.id));}
/** Only operational facts and attributed operator statements; never tools, reasoning or credential material. */
export function operationalSummary(state:AgentState,summary:string|null,event?:{lifecycle?:string;admin?:HumanStatement;reviewedHumanIds?:string[];factEdit?:FactEdit}){
  const m=conversationMemory(summary);
  if(event?.lifecycle)m.lifecycle=event.lifecycle;
  if(event?.admin&&!m.humanStatements.some(s=>s.id===event.admin!.id)){
    const text=/secret|api[ _-]?key|password|пароль|токен|bearer\s|sk-[a-z0-9]|https?:\/\/\S*[?&](?:token|key)=/iu.test(event.admin.text)?'[Private credential omitted]':event.admin.text;
    m.humanStatements.push({id:event.admin.id,text:text.slice(0,1500)});
  }
  m.reviewedHumanIds=[...new Set([...m.reviewedHumanIds,...event?.reviewedHumanIds??[]])];
  if(event?.factEdit){
    // Keep the latest typed value of each field with its server timestamp, so replaying
    // older operator prose cannot undo a later explicit edit in the Inbox form.
    const keys=Object.keys(event.factEdit.facts);
    m.factEdits=(m.factEdits??[]).map(edit=>({...edit,facts:Object.fromEntries(Object.entries(edit.facts).filter(([key])=>!keys.includes(key)))})).filter(edit=>Object.keys(edit.facts).length);
    m.factEdits.push({at:event.factEdit.at,facts:Object.fromEntries(keys.map(key=>[key,state.draftFacts?.[key as keyof typeof state.draftFacts]]))});
  }
  // Reviewed corrections live in structured facts. Unresolved operator context is never silently truncated.
  m.humanStatements=m.humanStatements.filter(s=>!m.reviewedHumanIds.includes(s.id)).concat(m.humanStatements.filter(s=>m.reviewedHumanIds.includes(s.id)).slice(-4));
  return JSON.stringify({...m,facts:{draftFacts:state.draftFacts,name:state.name,phone:state.phone,address:state.address?{fullAddress:state.address.fullAddress,apartment:state.address.apartment}:undefined,quote:state.quote?{input:state.quote.input,total:state.quote.total,requiresHumanReview:state.quote.requiresHumanReview}:undefined,requestedWindow:state.requestedWindow,slots:state.slots?.map(({start,duration})=>({start,duration})),pending:state.pending?{recap:state.pending.recap,awaitingConfirmation:!state.pending.confirmedByMessageId}:undefined,booking:state.booking?{reference:state.booking.reference,service:state.booking.service,area:state.booking.area,start:state.booking.start}:undefined,review:state.review}});
}
/** Trailing unanswered CLIENT messages. Cancelled/failed outbound is not a response. */
export async function currentClientTurn(tx:Prisma.TransactionClient,conversationId:string,throughMessageId?:string){
  const through=throughMessageId?await tx.message.findFirst({where:{id:throughMessageId,conversationId,author:'CLIENT'}}):null;
  if(throughMessageId&&!through)return [];
  const boundary=await tx.message.findFirst({where:{conversationId,author:{not:'CLIENT'},deliveryStatus:{notIn:['CANCELLED','FAILED','UNKNOWN','INTERNAL']},...(through?{OR:[{sentAt:{lt:through.sentAt}},{sentAt:through.sentAt,id:{lt:through.id}}]}:{})},orderBy:[{sentAt:'desc'},{id:'desc'}]});
  const constraints:Prisma.MessageWhereInput[]=[];
  if(boundary)constraints.push({OR:[{sentAt:{gt:boundary.sentAt}},{sentAt:boundary.sentAt,id:{gt:boundary.id}}]});
  if(through)constraints.push({OR:[{sentAt:{lt:through.sentAt}},{sentAt:through.sentAt,id:{lte:through.id}}]});
  const turn:Message[]=await tx.message.findMany({where:{conversationId,author:'CLIENT',AND:constraints},orderBy:[{sentAt:'asc'},{id:'asc'}]});
  return turn;
}
