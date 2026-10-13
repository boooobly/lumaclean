// Native calls and real state on the established isolated Preview database.
// No production contacts, orders or messages. Existing quotas stay enforced.
import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {autonomyCorpus} from '../../src/lib/agent/autonomy-corpus';
import {PoyoProvider,OpenRouterProvider,type AIProvider} from '../../src/lib/agent/providers';
import {AgentError,type AgentState} from '../../src/lib/agent/contracts';
import {acceptMessage} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
const url=process.env.DATABASE_URL;
if(!url||!new URL(url).hostname.startsWith('ep-wispy-river-b8xwqy9q'))throw Error('ISOLATED_PREVIEW_REQUIRED');
process.env.AI_AGENT_ENABLED='true';
const name=process.argv[2],ids=process.argv.slice(3);
if(!['poyo','openrouter'].includes(name))throw Error('EXPLICIT_PROVIDER_REQUIRED');
const key=process.env[name==='poyo'?'POYO_API_KEY':'OPENROUTER_API_KEY'];
const path='qa-output/autonomy-native-'+name+'.json';
if(!key||key==='[SENSITIVE]'){const r={provider:name,status:'INCONCLUSIVE',reason:'NATIVE_CREDENTIAL_UNAVAILABLE',scenarios:0};writeFileSync(path,JSON.stringify(r,null,2));console.log(r);process.exit(0);}
const model=name==='poyo'?'gpt-6-luna':'openai/gpt-6-luna'; // Verified production AIInvocation models, no business setting change.
// Match the provider rates already used below, so production's reserve calculation
// sees the same verified model/rates. Do not change or refund the daily quota.
process.env.PRIMARY_AGENT_MODEL=model;
process.env.PRIMARY_AGENT_INPUT_USD_PER_MILLION=String(name==='poyo'?0.08:0.1);
process.env.PRIMARY_AGENT_OUTPUT_USD_PER_MILLION=String(name==='poyo'?0.4:0.5);
const selected:AIProvider=name==='poyo'?new PoyoProvider(model,key,fetch,{input:0.08,output:0.4}):new OpenRouterProvider(model,key,fetch,{input:0.1,output:0.5});
const unavailable:AIProvider={name:'disabled',model,complete:async()=>{throw new AgentError('PROVIDER_UNCONFIGURED');}};
const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url),max:3})});
const rows:Record<string,unknown>[]=[];
async function main(){
 const baseline=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
 if(baseline.aiAgentMode!=='AUTO'||(baseline.aiChannelModes as Record<string,string>).WEBSITE!=='AUTO')throw Error('PREVIEW_AUTO_REQUIRED');
 let inconclusive=0;
 for(const s of autonomyCorpus.filter(s=>!s.event&&(!ids.length||ids.includes(s.id)))){
  const c=await db.conversation.create({data:{channel:'WEBSITE',locale:s.locale,externalThreadId:'autonomy-native:'+randomUUID(),displayAlias:'Mila'}});
  try{
   await acceptMessage(db,c,{id:randomUUID(),text:s.text});const claim=await claimJob(db,c.id);if(!claim)throw Error('CLAIM_REQUIRED');await runClaimedJob(db,claim,[selected,unavailable]);
   const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}}),state=current.state as AgentState;
   const tools=await db.agentToolTrace.findMany({where:{conversationId:c.id},select:{tool:true,outcome:true}}),invocations=await db.aIInvocation.findMany({where:{conversationId:c.id},select:{provider:true,success:true,errorCode:true}}),handoffs=await db.humanHandoff.findMany({where:{conversationId:c.id},select:{reason:true}}),reply=await db.message.findFirst({where:{conversationId:c.id,author:'AI'},orderBy:{sentAt:'desc'},select:{text:true,structured:true}});
   const hard=handoffs.some(h=>!h.reason.startsWith('SOFT:')),soft=handoffs.some(h=>h.reason.startsWith('SOFT:')),outcome=hard?'HARD_HANDOFF':soft?'SOFT_REVIEW':'AI_HANDLES';
   const providerAvailable=invocations.some(i=>i.provider===name&&i.success);
   const quota=invocations.some(i=>/LIMIT|BUDGET/.test(i.errorCode??''));
   const recovered=(reply?.structured as {autonomy?:{recovery?:boolean}}|null)?.autonomy?.recovery===true;
   const factsPreserved=!s.facts||Object.entries(s.facts).every(([k,v])=>state.draftFacts?.[k as keyof NonNullable<AgentState['draftFacts']>]===v);
   const faq=s.category.includes('faq')||['public-price','service-difference','windows','appliance','upholstery-price','language-switch'].includes(s.category);
   const grounded=!faq||tools.some(t=>t.tool==='getBusinessInfo'&&t.outcome==='OK');
   const status=invocations.length>0&&!providerAvailable||quota?'INCONCLUSIVE':outcome===s.expected&&!recovered&&factsPreserved&&grounded&&!!reply?(providerAvailable?'PASS':'DOMAIN_PASS'):'FAIL';
   const row={id:s.id,provider:name,status,expected:s.expected,outcome,recovered,providerAvailable,grounded,tools,invocations,handoffs,control:current.control,factsPreserved,hasLead:!!current.leadId,bookingBlocked:!!state.upholsteryInquiry||!!state.review?.reasons.length,response:reply?.text??null};rows.push(row);console.log(JSON.stringify({id:s.id,status,outcome}));
   if(status==='INCONCLUSIVE')inconclusive++;else inconclusive=0;
  }finally{
   const own=await db.conversation.findUniqueOrThrow({where:{id:c.id}});if(!own.externalThreadId?.startsWith('autonomy-native:')||own.orderId)throw Error('OWN_FIXTURE_CLEANUP_REVIEW_REQUIRED');
   await db.$transaction(async tx=>{await tx.notification.deleteMany({where:{conversationId:c.id}});await tx.agentToolTrace.deleteMany({where:{conversationId:c.id}});await tx.aIInvocation.deleteMany({where:{conversationId:c.id}});await tx.shadowSuggestion.deleteMany({where:{conversationId:c.id}});await tx.agentSlot.deleteMany({where:{conversationId:c.id}});await tx.humanHandoff.deleteMany({where:{conversationId:c.id}});await tx.agentJob.deleteMany({where:{conversationId:c.id}});await tx.message.updateMany({where:{conversationId:c.id},data:{responseToMessageId:null}});await tx.message.deleteMany({where:{conversationId:c.id}});await tx.conversation.delete({where:{id:c.id}});if(own.leadId)await tx.lead.delete({where:{id:own.leadId}});});
   writeFileSync(path,JSON.stringify({provider:name,scope:'Native provider + actual Preview domain actions; one-turn corpus subset; no booking proof',rows,cleaned:true},null,2));
  }
  if(inconclusive>=3){console.log('Stopped after three inconclusive provider/quota results; no limit bypass.');break;}
 }
}
main().catch(e=>{console.error(e instanceof AgentError?e.code:e.message);process.exitCode=1;}).finally(()=>db.$disconnect());
