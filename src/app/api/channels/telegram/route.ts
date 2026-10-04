import { after, NextResponse } from "next/server";
import { getDatabase } from "@/lib/database/client";
import { boundedBody } from "@/lib/services/admin-http";
import { customerTelegramConfigured, normalizeTelegram, verifyWebhookSecret } from "@/lib/agent/channels";
import { acceptChannelMessage } from "@/lib/agent/inbox";
import { drainAgentJobs } from "@/lib/agent/runner";
import { enqueueAgent } from "@/lib/agent/queue";
import { AgentError } from "@/lib/agent/contracts";
import { CrmError } from "@/lib/domain/crm";
export const runtime="nodejs";
export const maxDuration=180;
export async function POST(request:Request){
  if(!customerTelegramConfigured())return NextResponse.json({ok:false,disabled:true},{status:503});
  if(!verifyWebhookSecret(request.headers.get("x-telegram-bot-api-secret-token")))return NextResponse.json({ok:false},{status:403});
  try{
    const event=normalizeTelegram(JSON.parse((await boundedBody(request,12000)).toString()));
    if(event){const db=getDatabase();const accepted=await acceptChannelMessage(db,event);const job=await db.agentJob.findUniqueOrThrow({where:{messageId:accepted.messageId}});if(!await enqueueAgent(db,job.conversationId))after(()=>drainAgentJobs(db,job.conversationId));}
    // ACK only after durable message/job commit; provider work is after the response.
    return NextResponse.json({ok:true});
  }catch(e){return NextResponse.json({ok:false},{status:e instanceof AgentError&&e.code==='QUEUE_UNAVAILABLE'?503:e instanceof AgentError||e instanceof SyntaxError||e instanceof CrmError?400:503});}
}
