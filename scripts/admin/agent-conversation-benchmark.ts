/** Real Preview ingress/jobs/domain tools, synthetic WEBSITE fixtures, bounded paid calls. */
import {randomUUID,createHash} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {OpenRouterProvider,type AIProvider,type Completion} from '../../src/lib/agent/providers';
import {acceptMessage} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
import {operationalSummary} from '../../src/lib/agent/conversation-memory';
import {masculineSelfReference} from '../../src/lib/agent/persona';
import {repeatedQualification} from '../../src/lib/agent/autonomy';
import {calculatePrice} from '../../src/lib/pricing';
import {llmFirstDialogues,type Dialogue} from '../../tests/agent/fixtures/llm-first-dialogues';
import type {AgentState} from '../../src/lib/agent/contracts';
import {sourceFingerprint} from '../../src/lib/agent/release-verification.mjs';

const arg=(name:string,fallback:string)=>process.argv.find(a=>a.startsWith(name+'='))?.slice(name.length+1)??fallback;
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v??null)).digest('hex');
const quantile=(a:number[],p:number)=>a.length?[...a].sort((x,y)=>x-y)[Math.ceil(p*a.length)-1]:null;
export function summarize(rows:Row[]){
 const completed=rows.filter(r=>r.status==='PASS'),turns=rows.flatMap(r=>r.turns),usages=turns.flatMap(t=>t.usage),cost=usages.reduce((n,c)=>n+(c.billedCostUsd??c.estimatedCostUsd??0),0);
 return {successful:completed.length,total:rows.length,inconclusive:rows.filter(r=>r.status==='INCONCLUSIVE').length,factAccuracy:rows.reduce((n,r)=>n+r.factsCorrect,0)+'/'+rows.reduce((n,r)=>n+r.factsTotal,0),repeatedQuestions:turns.filter(t=>t.repeated).length,incorrectToolCalls:turns.flatMap(t=>t.tools).filter(t=>t.outcome!=='OK').length,hardHandoff:turns.filter(t=>t.hard).length,softReview:turns.filter(t=>t.soft).length,bookingSafetyFailures:rows.filter(r=>!r.safe).length,p50LatencyMs:quantile(turns.map(t=>t.latencyMs),.5),p95LatencyMs:quantile(turns.map(t=>t.latencyMs),.95),averageTokensPerDialogue:rows.length?usages.reduce((n,c)=>n+c.inputTokens+c.outputTokens,0)/rows.length:null,reasoningTokens:usages.every(c=>c.reasoningTokens!==undefined)?usages.reduce((n,c)=>n+c.reasoningTokens!,0):null,modelCalls:usages.length,totalCostUsd:cost,averageCostPerCompletedDialogue:completed.length?completed.flatMap(r=>r.turns).flatMap(t=>t.usage).reduce((n,c)=>n+(c.billedCostUsd??c.estimatedCostUsd??0),0)/completed.length:null,amortizedCostPerSuccess:completed.length?cost/completed.length:null,providerErrors:turns.reduce((n,t)=>n+t.providerErrors,0),answerRoutes:turns.reduce((acc,t)=>({...acc,[t.route]:(acc[t.route]??0)+1}),{} as Record<string,number>),blindQuality:'PENDING'};
}
type Turn={customer:string[];answer:string;facts:unknown;quote:unknown;tools:{tool:string;outcome:string}[];usage:Completion[];latencyMs:number;route:string;hard:boolean;soft:boolean;repeated:boolean;persona:boolean;providerErrors:number;invocationErrors?:string[];handoffReasons?:string[];safe:boolean};
type Row={id:string;model:string;strategy:string;status:'PASS'|'FAIL'|'INCONCLUSIVE';turns:Turn[];factsCorrect:number;factsTotal:number;safe:boolean;cleaned:boolean;failure?:string};

async function main(){
 if(!process.argv.includes('--live'))throw Error('LIVE_OPT_IN_REQUIRED');
 const url=process.env.DATABASE_URL;
 if(!url||!new URL(url).hostname.startsWith('ep-wispy-river-b8xwqy9q')||process.env.VERCEL_ENV!=='preview'||process.env.VERCEL==='1')throw Error('ISOLATED_LOCAL_PREVIEW_REQUIRED');
 if(!process.env.OPENROUTER_API_KEY||process.env.OPENROUTER_API_KEY==='[SENSITIVE]')throw Error('KEY_REQUIRED');
 const apiKey=process.env.OPENROUTER_API_KEY;
 // No channel credentials or external queue are available in this harness.
 if(['TELEGRAM_BOT_TOKEN','WHATSAPP_ACCESS_TOKEN','VIBER_BOT_TOKEN'].some(k=>process.env[k]&&process.env[k]!=='[SENSITIVE]'))throw Error('OUTBOUND_CREDENTIALS_FORBIDDEN');
 const split=arg('--split','development'),limit=Number(arg('--limit','48'));
 const models=arg('--models','openai/gpt-6-luna,anthropic/claude-haiku-5.5').split(',');
 const strategies=arg('--strategies','HYBRID').split(',');
 if(models.some(m=>!['openai/gpt-6-luna','anthropic/claude-haiku-5.5'].includes(m))||strategies.some(s=>!['HYBRID','LLM_FIRST'].includes(s)))throw Error('INVALID_MATRIX');
 const scenarios=llmFirstDialogues.filter(s=>s.split===split).slice(0,limit);
 if(!scenarios.length)throw Error('EMPTY_CORPUS');
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url),max:6})});
 const path='qa-output/llm-first-'+arg('--label',split)+'-'+Date.now()+'.json';
 const rows:Row[]=[];
 let spent=0,calls=0,failures=0;
 const maxCost=2,maxCalls=1500;
 const config={services:await db.service.findMany({include:{durationRules:true}}),extras:await db.serviceExtra.findMany(),settings:await db.businessSettings.findUniqueOrThrow({where:{id:'default'}}),cleaners:await db.cleaner.findMany({include:{availability:true}})};
 const report={manifest:{base:'9516f2922f2a86b2d5829c26d548046614e37aad',source:sourceFingerprint(),fixtureHash:hash(config),corpusHash:hash(llmFirstDialogues),split,models,strategies,settings:{maxTokens:1600,reasoningEffort:'low',requireParameters:true},maxCost,maxCalls,startedAt:new Date().toISOString(),catalog:JSON.parse(readFileSync('qa-output/llm-first-model-smoke.json','utf8')).rows.map((r:{metadata:unknown})=>r.metadata)},rows,summary:{} as Record<string,unknown>};
 mkdirSync('qa-output',{recursive:true});
 const save=()=>{report.summary=Object.fromEntries(models.flatMap(model=>strategies.map(strategy=>[model+'/'+strategy,summarize(rows.filter(r=>r.model===model&&r.strategy===strategy))])));writeFileSync(path,JSON.stringify(report,null,2));};
 try{
  const tasks=scenarios.flatMap(s=>strategies.flatMap(strategy=>models.map(model=>({s,strategy,model}))));let next=0;
  const concurrency=Math.min(4,Math.max(1,Number(arg('--concurrency','1'))));
  await Promise.all(Array.from({length:concurrency},async()=>{while(next<tasks.length){
   const {s,strategy,model}=tasks[next++];
   if(spent>=maxCost||calls>=maxCalls||failures>=3){console.log('BOUNDED_RUN_STOPPED');save();return;}
   const native=new OpenRouterProvider(model,apiKey,fetch,{input:.1,output:.5},{maxTokens:1600,reasoningEffort:'low'});
   const usage:Completion[]=[];
   const provider:AIProvider={name:native.name,model:native.model,complete:async(m,signal,options)=>{
    if(spent>=maxCost-.005||calls++>=maxCalls)throw Error('BENCHMARK_COST_LIMIT');
    const c=await native.complete(m,signal,options);usage.push(c);spent+=c.billedCostUsd??c.estimatedCostUsd??.005;return c;
   }};
   const row:Row={id:s.id,model,strategy,status:'FAIL',turns:[],factsCorrect:0,factsTotal:Object.keys(s.facts).length,safe:true,cleaned:false};rows.push(row);
   const c=await db.conversation.create({data:{channel:'WEBSITE',locale:s.locale,externalThreadId:'llm-benchmark:'+randomUUID(),displayAlias:'Mila',state:s.initial}});
   try{
    for(let i=0;i<s.turns.length;i++){
     let current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
     if(current.control!=='AI_CONTROL')break;
     if(s.takeover&&i===1){
      const statement={id:randomUUID(),text:s.locale==='ru'?'Клиент уточнил: 70 м²':s.locale==='en'?'Customer correction: 70m2':'Klijent je potvrdio 70 m2'};
      await db.conversation.update({where:{id:c.id},data:{control:'HUMAN_CONTROL'}});
      await db.message.create({data:{id:statement.id,conversationId:c.id,author:'ADMIN',text:statement.text,deliveryStatus:'DELIVERED'}});
      await db.conversation.update({where:{id:c.id},data:{control:'AI_CONTROL',summary:operationalSummary(current.state as AgentState,current.summary,{admin:statement})}});
      current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
     }
     const started=Date.now(),before=usage.length;
     let accepted:{messageId:string}|undefined;
     for(const text of s.turns[i]){current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});accepted=await acceptMessage(db,current,{id:randomUUID(),text});}
     const claim=await claimJob(db,c.id);if(!claim)throw Error('CLAIM_REQUIRED');
     // Trusted local option; no public request can choose a strategy.
     if(strategy==='HYBRID')await runClaimedJob(db,claim,[provider,provider]);
     else await runClaimedJob(db,claim,[provider,provider],undefined,undefined,{strategy:'LLM_FIRST'});
     current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
     const state=current.state as AgentState;
     const answer=await db.message.findUnique({where:{responseToMessageId:accepted!.messageId}});
     const tools=await db.agentToolTrace.findMany({where:{jobId:claim.job.id},select:{tool:true,outcome:true}});
     const invocations=await db.aIInvocation.findMany({where:{jobId:claim.job.id},select:{success:true,errorCode:true}});
     const handoffs=await db.humanHandoff.findMany({where:{conversationId:c.id,resolvedAt:null},select:{reason:true}});
     const jobUsage=usage.slice(before),recovery=(answer?.structured as {autonomy?:{recovery?:boolean}})?.autonomy?.recovery===true;
     const hard=handoffs.some(h=>!h.reason.startsWith('SOFT:')),soft=handoffs.some(h=>h.reason.startsWith('SOFT:'));
     const safe=!current.orderId&&!state.booking&&!tools.some(t=>s.forbid.includes(t.tool as Dialogue['must'][number])&&t.outcome==='OK');
     row.safe&&=safe;
     const quoted=tools.some(t=>t.tool==='calculatePrice'&&t.outcome==='OK');
     const composed=jobUsage.some(u=>u.text.trim()&&answer?.text.includes(u.text.trim()));
     const route=hard?'handoff':invocations.some(v=>!v.success)?'fallback/recovery':state.lastDecision?.answerOrigin??(recovery?'fallback/recovery':composed?(quoted?'deterministic quote + LLM response':'LLM-generated'):'deterministic-only');
     row.turns.push({customer:s.turns[i],answer:answer?.text??'',facts:state.draftFacts,quote:state.quote?{input:state.quote.input,total:state.quote.total,base:state.quote.base}:null,tools,usage:jobUsage,latencyMs:Date.now()-started,route,hard,soft,repeated:repeatedQualification(answer?.text??'',state),persona:!!masculineSelfReference(answer?.text??'',s.locale),providerErrors:invocations.filter(v=>!v.success).length,invocationErrors:invocations.filter(v=>!v.success).map(v=>v.errorCode??'UNKNOWN'),handoffReasons:handoffs.map(h=>h.reason),safe});
     if(!answer||await db.message.count({where:{responseToMessageId:accepted!.messageId}})!==1)throw Error('SINGLE_REPLY_REQUIRED');
     // Preserve counters and the ordinary 8/min ingress quota; no reset or bypass.
     save();
    }
    const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=current.state as AgentState;
    row.factsCorrect=Object.entries(s.facts).filter(([key,v])=>hash(state.draftFacts?.[key as keyof Dialogue['facts']])===hash(v)).length;
    const toolList=row.turns.flatMap(t=>t.tools).filter(t=>t.outcome==='OK').map(t=>t.tool);
    const expected=s.result==='HANDOFF'?current.control==='HUMAN_CONTROL':s.result==='REVIEW'?!!state.review?.reasons.length:s.result==='QUOTE'?!!state.quote:true;
    const price=!state.quote||state.quote.total===calculatePrice(state.quote.input.service,state.quote.input.area,state.quote.input.extras,state.quote.input.urgent).total;
    const complete=row.turns.length===s.turns.length;
    const unavailable=row.turns.some(t=>t.providerErrors>0);
    row.status=unavailable?'INCONCLUSIVE':complete&&row.safe&&price&&expected&&row.factsCorrect===row.factsTotal&&s.must.every(t=>toolList.includes(t))&&!row.turns.some(t=>t.repeated||t.persona||!t.answer||t.route==='fallback/recovery')?'PASS':'FAIL';
    failures=unavailable?failures+1:0;
   }catch(e){row.status='INCONCLUSIVE';row.failure=e instanceof Error?e.message:'RUN_FAILED';failures++;}
   finally{
    const own=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
    if(!own.externalThreadId?.startsWith('llm-benchmark:')||own.orderId||own.clientId||own.identityVerified)throw Error('CLEANUP_OWNERSHIP_REQUIRED');
    await db.$transaction(async tx=>{
     const scope={conversationId:c.id};
     await tx.notification.deleteMany({where:scope});await tx.agentToolTrace.deleteMany({where:scope});await tx.aIInvocation.deleteMany({where:scope});await tx.shadowSuggestion.deleteMany({where:scope});await tx.agentSlot.deleteMany({where:scope});await tx.humanHandoff.deleteMany({where:scope});await tx.agentJob.deleteMany({where:scope});
     await tx.message.updateMany({where:scope,data:{responseToMessageId:null}});await tx.message.deleteMany({where:scope});await tx.conversation.delete({where:{id:c.id}});
     if(own.leadId){if(!await tx.lead.count({where:{id:own.leadId,submissionId:'agent:'+c.id}}))throw Error('LEAD_OWNERSHIP_REQUIRED');await tx.leadExtra.deleteMany({where:{leadId:own.leadId}});await tx.lead.delete({where:{id:own.leadId}});}
    },{timeout:30000});row.cleaned=true;save();
   }
   console.log(JSON.stringify({id:s.id,model,strategy,status:row.status,turns:row.turns.length,calls:row.turns.reduce((n,t)=>n+t.usage.length,0),cost:spent,cleaned:row.cleaned,path}));
  }}));
 }finally{await db.$disconnect();save();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'BENCHMARK_FAILED');process.exitCode=1;});
