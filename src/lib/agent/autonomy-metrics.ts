import type {AgentState} from './contracts';
type Row={id:string;state:unknown;orderId:string|null;lastMessageAt:Date;jobs?:{createdAt:Date;status:string}[];messages:{author:string;text:string;sentAt:Date;structured:unknown;deliveryStatus:string}[];handoffs:{id:string;reason:string}[];toolTraces:{tool:string;outcome:string;createdAt:Date;shadow:boolean}[];invocations:{jobId:string|null;provider:string;success:boolean}[]};
export function autonomyMetrics(rows:Row[],humanIds:Set<string>,assessments:Map<string,boolean>,now=new Date()){
 let substantive=0,aiOnlyConsultation=0,fullAutomation=0,hardHandoff=0,softReview=0,humanTouched=0,aiBookings=0,unknown=0,unanswered=0,abandoned=0,toolCalls=0,toolFailures=0,repeated=0,providerJobs=0,fallbackJobs=0,audited=0,falsePositive=0;
 const reasons:Record<string,number>={},quoteTurns:number[]=[],bookingTurns:number[]=[];
 for(const c of rows){
  const state=c.state as AgentState,clients=c.messages.filter(m=>m.author==='CLIENT'),traces=c.toolTraces.filter(t=>!t.shadow);
  const useful=c.messages.filter(m=>m.author==='AI'&&m.deliveryStatus==='DELIVERED'&&(m.structured as {autonomy?:{useful?:boolean}}|null)?.autonomy?.useful);
  const booked=!!c.orderId&&!!state.booking&&traces.some(t=>t.tool==='createOrder'&&t.outcome==='OK');
  const onlyGreeting=clients.length>0&&clients.every(m=>/^(?:hello|hi|hey|привет|здравствуйте|вы тут|здраво|zdravo|cao|ćao)[!?.,\s]*$/iu.test(m.text.trim()));
  const customerContent=clients.some(m=>/[\p{L}\p{N}]{3,}/u.test(m.text)&&!/^(?:hello|hi|hey|привет|здравствуйте|вы тут|здраво|zdravo|cao|ćao|спасибо|благодарю|thanks|thank you|hvala|хвала)[!?.,\s]*$/iu.test(m.text.trim()));
  // Failed or unanswered substantive requests belong in the denominator too.
  if(onlyGreeting||!customerContent&&!Object.keys(state.draftFacts??{}).length&&!useful.length&&!booked&&!c.handoffs.length)continue;
  substantive++;
  const hard=c.handoffs.filter(h=>!h.reason.startsWith('SOFT:')),soft=c.handoffs.some(h=>h.reason.startsWith('SOFT:'));
  const touched=humanIds.has(c.id)||c.messages.some(m=>m.author==='ADMIN');
  if(hard.length)hardHandoff++;if(soft)softReview++;if(touched)humanTouched++;if(booked)aiBookings++;
  for(const h of hard){reasons[h.reason]=(reasons[h.reason]??0)+1;if(assessments.has(h.id)){audited++;if(assessments.get(h.id))falsePositive++;}}
  const acknowledged=useful.some(a=>clients.some(m=>m.sentAt>a.sentAt&&/^(?:спасибо|благодарю|thanks|thank you|hvala|хвала|понятно[, .]*спасибо)[.!\s]*$/iu.test(m.text.trim())));
  if(!hard.length&&!soft&&!touched&&(acknowledged||booked))aiOnlyConsultation++;
  if(!hard.length&&!soft&&!touched&&booked)fullAutomation++;
  const last=clients.at(-1);if(last&&!c.messages.some(m=>['AI','ADMIN'].includes(m.author)&&m.sentAt>=last.sentAt&&m.deliveryStatus==='DELIVERED'))unanswered++;
  if(!acknowledged&&!booked){unknown++;if(now.getTime()-c.lastMessageAt.getTime()>86400000)abandoned++;}
  toolCalls+=traces.length;toolFailures+=traces.filter(t=>!['OK','SHADOW_MUTATION_BLOCKED'].includes(t.outcome)).length;repeated+=traces.filter(t=>t.tool==='requestCustomerInput'&&t.outcome==='FACT_ALREADY_KNOWN').length;
  const jobs=new Map<string,typeof c.invocations>();for(const i of c.invocations)if(i.jobId)jobs.set(i.jobId,[...(jobs.get(i.jobId)??[]),i]);
  providerJobs+=jobs.size;fallbackJobs+=[...jobs.values()].filter(v=>v.some(i=>i.provider==='poyo'&&!i.success)&&v.some(i=>i.provider==='openrouter'&&i.success)).length;
  for(const [tool,list] of [['calculatePrice',quoteTurns],['createOrder',bookingTurns]] as const){const t=traces.find(t=>t.tool===tool&&t.outcome==='OK');if(t)list.push(c.jobs?c.jobs.filter(j=>j.createdAt<=t.createdAt&&j.status!=='SUPERSEDED').length:clients.filter(m=>m.sentAt<=t.createdAt).length);}
 }
 const mean=(v:number[])=>v.length?v.reduce((n,x)=>n+x,0)/v.length:null;
 return {substantive,aiOnlyConsultation,fullAutomation,hardHandoff,softReview,humanTouched,aiBookings,unknown,unanswered,abandoned,toolCalls,toolFailures,toolFailureRate:toolCalls?100*toolFailures/toolCalls:null,providerFallbackRate:providerJobs?100*fallbackJobs/providerJobs:null,repeatedQuestionAttempts:repeated,repeatedQuestionRate:toolCalls?100*repeated/toolCalls:null,averageTurnsToQuote:mean(quoteTurns),averageTurnsToBooking:mean(bookingTurns),reasons,audited,falsePositive,falsePositiveRate:audited?100*falsePositive/audited:null,consultationRate:substantive?100*aiOnlyConsultation/substantive:null,automationRate:substantive?100*fullAutomation/substantive:null};
}
