import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient, type AgentMode } from "@/generated/prisma/client";
import { schedulingLock } from "@/lib/services/scheduling-commands";
import { writeAudit } from "@/lib/services/audit";
import { AgentError, type AgentState } from "./contracts";
import { configuredProviders, type AIProvider, type AgentMessage, type Completion } from "./providers";
import { conversationPolicy, substantiveIntent, mandatoryHandoff, handoffText, outputAllowed } from "./policy";
import { executeAgentTool, json, stateOf, type ToolContext } from "./tools";
import { deliverOutbox } from "./inbox";

export function modelState(state:AgentState){
  return{...state,address:state.address?{fullAddress:state.address.fullAddress,apartment:state.address.apartment}:undefined,pending:state.pending?{recap:state.pending.recap,slotToken:state.pending.slotToken,reschedule:state.pending.reschedule,confirmed:!!state.pending.confirmedByMessageId,confirmedByMessageId:state.pending.confirmedByMessageId?"server-confirmed":undefined}:undefined,booking:state.booking?{...state.booking,orderId:undefined}:undefined};
}
export async function completeWithFallback(providers:[AIProvider,AIProvider],messages:AgentMessage[],observe:(provider:AIProvider,result:Completion|null,errorCode:string|null,latency:number)=>Promise<void>,signal?:AbortSignal){
  for(let index=0;index<2;index++){
    const provider=providers[index],started=Date.now();
    try{const result=await provider.complete(messages,signal);await observe(provider,result,null,Date.now()-started);return result;}
    catch(e){const code=e instanceof AgentError?e.code:"PROVIDER_FAILED";await observe(provider,null,code,Date.now()-started);if(signal?.aborted)throw new AgentError("AGENT_DEADLINE");}
  }
  throw new AgentError("PROVIDERS_UNAVAILABLE");
}
async function callBudget(db:PrismaClient,messages:AgentMessage[],provider:AIProvider){
  const chars=JSON.stringify(messages).length;
  if(chars>48000)throw new AgentError("CONTEXT_LIMIT");
  const prefix=provider.model===process.env.PRIMARY_AGENT_MODEL?"PRIMARY":"FALLBACK";
  const input=Number(process.env[`${prefix}_AGENT_INPUT_USD_PER_MILLION`]),output=Number(process.env[`${prefix}_AGENT_OUTPUT_USD_PER_MILLION`]);
  const reserve=Number.isFinite(input)&&Number.isFinite(output)?Math.max(0.005,(chars*input+1200*output)/1e6):0.1;
  const units=Math.ceil(reserve*1e6),limit=Math.min(100,Math.max(0.05,Number(process.env.AI_DAILY_BUDGET_USD)||5))*1e6;
  const key=`agent:budget:${new Date().toISOString().slice(0,10)}`,now=Date.now();
  const row=await db.$queryRaw<{count:number}[]>`INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES (${randomUUID()},${key},${units},${BigInt(now)}) ON CONFLICT (key) DO UPDATE SET count="RateLimit".count+${units} RETURNING count`;
  if(row[0].count>limit)throw new AgentError("DAILY_BUDGET_LIMIT");
}
export async function claimJob(db:PrismaClient,conversationId?:string){
  const now=new Date();
  const candidates=await db.agentJob.findMany({where:{...(conversationId?{conversationId}:{}),OR:[{status:"PENDING"},{status:"RUNNING",leaseUntil:{lt:now}}]},orderBy:{createdAt:"asc"},take:8});
  for(const candidate of candidates){
    const claim=await db.$transaction(async tx=>{
      await schedulingLock(tx,"conversation",candidate.conversationId);
      const running=await tx.agentJob.count({where:{conversationId:candidate.conversationId,status:"RUNNING",leaseUntil:{gt:now}}});
      if(running)return null;
      const latest=await tx.agentJob.findFirst({where:{conversationId:candidate.conversationId,OR:[{status:"PENDING"},{status:"RUNNING",leaseUntil:{lt:now}}]},orderBy:{createdAt:"desc"}});
      if(!latest)return null;
      await tx.agentJob.updateMany({where:{conversationId:latest.conversationId,id:{not:latest.id},status:{in:["PENDING","RUNNING"]}},data:{status:"SUPERSEDED",completedAt:now,leaseUntil:null,leaseKey:null}});
      const c=await tx.conversation.findUniqueOrThrow({where:{id:latest.conversationId}}),settings=await tx.businessSettings.findUniqueOrThrow({where:{id:"default"}});
      const mode:AgentMode=process.env.AI_AGENT_ENABLED==="true"?settings.aiAgentMode:"OFF";
      if(mode==="OFF"||c.control!=="AI_CONTROL"){
        await tx.agentJob.update({where:{id:latest.id},data:{status:"DONE",completedAt:now,leaseUntil:null}});return null;
      }
      const leaseKey=randomUUID();
      const job=await tx.agentJob.update({where:{id:latest.id},data:{status:"RUNNING",attempts:{increment:1},leaseKey,leaseUntil:new Date(Date.now()+180000)}});
      return{job,conversation:c,mode,leaseKey};
    });
    if(claim)return claim;
  }
  return null;
}
async function persistAnswer(db:PrismaClient,ctx:ToolContext,text:string,plan:unknown[],leaseKey:string){
  await db.$transaction(async tx=>{
    await schedulingLock(tx,"conversation",ctx.conversationId);
    const c=await tx.conversation.findUniqueOrThrow({where:{id:ctx.conversationId}}),settings=await tx.businessSettings.findUniqueOrThrow({where:{id:"default"}});
    const job=await tx.agentJob.findUniqueOrThrow({where:{id:ctx.jobId}});
    if(c.revision!==ctx.revision||settings.aiAgentMode!==ctx.mode||process.env.AI_AGENT_ENABLED!=="true"||job.leaseKey!==leaseKey||job.status!=="RUNNING"||(c.control!=="AI_CONTROL"&&!(ctx.handoff&&c.stage==="HANDOFF"&&!c.ownerId)))throw new AgentError("AGENT_CONTROL_CHANGED");
    if(ctx.mode==="SHADOW")await tx.conversation.update({where:{id:c.id},data:{shadowState:json(ctx.state),shadowProposal:json({text,plan,stage:ctx.handoff?"HANDOFF":ctx.state.pending?"AWAITING_CONFIRMATION":ctx.state.quote?"QUOTING":"DISCOVERY",proposedState:modelState(ctx.state),at:new Date().toISOString()}),needsAttention:true}});
    else{
      const bookingRecap=ctx.state.booking?(({orderId,reference,...recap})=>{void orderId;void reference;return recap;})(ctx.state.booking):null;
      const structured=ctx.state.booking?{type:"booking",reference:ctx.state.booking.reference,recap:bookingRecap}:ctx.state.pending?{type:"confirmation",recap:ctx.state.pending.recap}:null;
      await tx.message.upsert({where:{conversationId_externalMessageId:{conversationId:c.id,externalMessageId:`agent:${ctx.jobId}:${ctx.revision}`}},create:{conversationId:c.id,author:"AI",text,structured:structured?json(structured):Prisma.DbNull,externalMessageId:`agent:${ctx.jobId}:${ctx.revision}`,deliveryStatus:c.channel==="WEBSITE"?"DELIVERED":"PENDING"},update:{}});
      await tx.conversation.update({where:{id:c.id},data:{lastMessageAt:new Date(),needsAttention:ctx.handoff||!!ctx.state.booking}});
    }
    await tx.agentJob.update({where:{id:ctx.jobId},data:{status:"DONE",completedAt:new Date(),leaseUntil:null,leaseKey:null,errorCode:null}});
  });
}
export async function runClaimedJob(db:PrismaClient,claim:NonNullable<Awaited<ReturnType<typeof claimJob>>>,providers?:[AIProvider,AIProvider]){
  const {job,conversation:c,mode,leaseKey}=claim;
  const ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:c.revision,mode,state:mode==="SHADOW"?structuredClone(c.shadowState) as AgentState:stateOf(c)};
  const plan:{tool:string;outcome:string}[]=[];
  let toolFailures=0,text="",formatRepaired=false;
  const signal=AbortSignal.timeout(85000);
  const tool=async(name:string,args:unknown)=>{
    const result=await executeAgentTool(db,ctx,name,args);
    plan.push({tool:name,outcome:typeof result.error==="string"?result.error:"OK"});
    if(result.error&&!['SHADOW_MUTATION_BLOCKED','CONTACT_REQUIRED','ADDRESS_REQUIRED','QUOTE_REQUIRED','IDENTITY_REQUIRED'].includes(String(result.error)))toolFailures++;
    return result;
  };
  try{
    const recent=await db.message.findMany({where:{conversationId:c.id},orderBy:{sentAt:"desc"},take:12});
    const current=recent.find(m=>m.id===job.messageId);
    if(!current)throw new AgentError("MESSAGE_NOT_FOUND");
    const forced=mandatoryHandoff(current.text);
    if(forced){await tool("requestHumanHandoff",{reason:forced});text=handoffText[c.locale as keyof typeof handoffText]??handoffText.ru;}
    else{
      if(substantiveIntent(current.text))await tool("createOrUpdateLead",{intent:"cleaning"});
      const compact=c.summary??null;
      const messages:AgentMessage[]=[{role:"system",content:conversationPolicy(c.locale,modelState(ctx.state) as AgentState,compact)},...recent.reverse().filter(m=>m.author!=="SYSTEM").map(m=>({role:(m.author==="CLIENT"?"user":"assistant") as "user"|"assistant",content:m.text.slice(0,1500)}))];
      const selected=providers??configuredProviders();
      for(let step=0;step<6&&!signal.aborted;step++){
        // Reconcile critical state before every provider retry/fallback; providers never execute tools.
        if(mode==="AUTO")ctx.state=stateOf(await db.conversation.findUniqueOrThrow({where:{id:c.id}}));
        messages[0]={role:"system",content:conversationPolicy(c.locale,modelState(ctx.state) as AgentState,compact)};
        const metered=selected.map(p=>({name:p.name,model:p.model,complete:async(m:AgentMessage[],s?:AbortSignal)=>{await callBudget(db,m,p);return p.complete(m,s);}})) as [AIProvider,AIProvider];
        const answer=await completeWithFallback(metered,messages,async(provider,result,errorCode,latency)=>{
          await db.aIInvocation.create({data:{conversationId:c.id,jobId:job.id,provider:provider.name,model:provider.model,inputTokens:result?.inputTokens??0,cachedInputTokens:result?.cachedInputTokens??0,outputTokens:result?.outputTokens??0,latencyMs:latency,estimatedCostUsd:result?.estimatedCostUsd,toolCallCount:result?.toolCalls.length??0,success:!errorCode,errorCode,mode}});
        },signal);
        if(!answer.toolCalls.length){
          if((answer.text.match(/\?/g)?.length??0)>2&&!formatRepaired){
            formatRepaired=true;
            messages.push({role:'assistant',content:answer.text},{role:'system',content:'Rewrite that draft briefly in the same language. Ask at most TWO related questions total. Do not repeat tools, do not invent facts or ask contact details too early.'});
            continue;
          }
          text=answer.text;break;
        }
        if(answer.toolCalls.length>4)throw new AgentError("TOOL_LIMIT");
        messages.push({role:"assistant",content:answer.text,toolCalls:answer.toolCalls});
        for(const call of answer.toolCalls){
          let args:unknown;
          try{args=JSON.parse(call.arguments);}catch{args=null;}
          const result=await tool(call.name,args);
          messages.push({role:"tool",toolCallId:call.id,content:JSON.stringify(result).slice(0,8000)});
          if(['NO_DURATION_RULE','ROUTING_UNRELIABLE','PRICE_REVIEW','NO_SLOTS','PRICE_CHANGED','SERVICE_UNAVAILABLE','EXTRA_UNAVAILABLE','RESCHEDULE_REVIEW_REQUIRED'].includes(String(result.error))||result.requiresHumanReview){
            const reason=result.error==='NO_DURATION_RULE'?"NO_DURATION_RULE":result.error==='ROUTING_UNRELIABLE'?"ROUTING_UNRELIABLE":result.error==='NO_SLOTS'?"NO_SLOTS":"PRICE_REVIEW";
            await tool("requestHumanHandoff",{reason});break;
          }
          if(toolFailures>=2){await tool("requestHumanHandoff",{reason:"TOOL_ERRORS"});break;}
          if(ctx.handoff)break;
        }
        if(ctx.handoff){text=handoffText[c.locale as keyof typeof handoffText]??handoffText.ru;break;}
      }
      if(!text||!outputAllowed(text,ctx.state,ctx.factAmounts)){
        await tool("requestHumanHandoff",{reason:"UNCERTAINTY"});text=handoffText[c.locale as keyof typeof handoffText]??handoffText.ru;
      }
    }
    await persistAnswer(db,ctx,text,plan,leaseKey);
    // Compact operational memory only: customer facts + bounded recent customer excerpts, no reasoning.
    if(await db.message.count({where:{conversationId:c.id}})>12){
      const old=await db.message.findMany({where:{conversationId:c.id,author:"CLIENT"},orderBy:{sentAt:"desc"},skip:6,take:6,select:{text:true}});
      await db.conversation.updateMany({where:{id:c.id,revision:ctx.revision},data:{summary:JSON.stringify({facts:modelState(ctx.state),earlierCustomerMessages:old.reverse().map(m=>m.text.slice(0,200))}).slice(0,3500)}});
    }
    await deliverOutbox(db,c.id);
  }catch(e){
    const code=e instanceof AgentError?e.code:"AGENT_OPERATION_FAILED";
    const stale=['AGENT_CONTROL_CHANGED','JOB_LEASE_LOST'].includes(code);
    await db.agentJob.updateMany({where:{id:job.id,leaseKey},data:{status:stale?"SUPERSEDED":"FAILED",errorCode:code,completedAt:new Date(),leaseUntil:null,leaseKey:null}});
    if(!stale){
      await db.conversation.update({where:{id:c.id},data:{needsAttention:true}});
      // Provider outage/budget/uncertain mutation never triggers an unverified booking retry.
      if(mode==="AUTO")await db.$transaction(async tx=>{
        await schedulingLock(tx,"conversation",c.id);
        const current=await tx.conversation.findUniqueOrThrow({where:{id:c.id}});
        if(current.revision!==ctx.revision||current.control!=="AI_CONTROL")return;
        if(!await tx.humanHandoff.count({where:{conversationId:c.id,resolvedAt:null}})){
          const handoff=await tx.humanHandoff.create({data:{conversationId:c.id,reason:code}});
          await writeAudit(tx,{type:"AI",key:`agent:${job.id}`},{action:"AI_HANDOFF_REQUESTED",entityType:"HumanHandoff",entityId:handoff.id});
        }
        await tx.conversation.update({where:{id:c.id},data:{control:"HUMAN_CONTROL",stage:"HANDOFF"}});
        await tx.message.upsert({where:{conversationId_externalMessageId:{conversationId:c.id,externalMessageId:`agent:${job.id}:${ctx.revision}`}},create:{conversationId:c.id,author:"AI",text:handoffText[current.locale as keyof typeof handoffText]??handoffText.ru,externalMessageId:`agent:${job.id}:${ctx.revision}`,deliveryStatus:current.channel==="WEBSITE"?"DELIVERED":"PENDING"},update:{}});
      });
      if(mode==="AUTO")await deliverOutbox(db,c.id);
    }
  }
}
export async function drainAgentJobs(db:PrismaClient,conversationId?:string,providers?:[AIProvider,AIProvider]){
  const deadline=Date.now()+85000;
  for(let i=0;i<2&&Date.now()<deadline;i++){const job=await claimJob(db,conversationId);if(!job)break;await runClaimedJob(db,job,providers);}
  await deliverOutbox(db,conversationId);
}
