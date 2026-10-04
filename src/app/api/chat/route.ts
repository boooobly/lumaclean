import { cookies } from "next/headers";
import { after, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { getDatabase } from "@/lib/database/client";
import { boundedBody } from "@/lib/services/admin-http";
import { CrmError } from "@/lib/domain/crm";
import { AgentError, publicInboundSchema } from "@/lib/agent/contracts";
import { acceptMessage, publicConversation, rateLimit, scopedConversation, startWebsiteConversation } from "@/lib/agent/inbox";
import { drainAgentJobs } from "@/lib/agent/runner";
import { enqueueAgent } from "@/lib/agent/queue";
export const runtime="nodejs";
export const maxDuration=180;
const cookieName="luma_conversation";
const noStore={"Cache-Control":"private, no-store","X-Robots-Tag":"noindex, nofollow"};
function trustedOrigin(request:Request){
  const origin=request.headers.get("origin");
  const allowed=[process.env.BETTER_AUTH_URL,process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:null];
  return !!origin&&allowed.includes(origin)&&request.headers.get("content-type")?.startsWith("application/json");
}
function errorResponse(e:unknown){
  const code=e instanceof AgentError?e.code:e instanceof ZodError||e instanceof SyntaxError||e instanceof CrmError?"INVALID_MESSAGE":"CHAT_UNAVAILABLE";
  return NextResponse.json({ok:false,error:code},{status:code==="RATE_LIMIT"?429:code==="INVALID_CONVERSATION"?401:code==='CONVERSATION_CLOSED'||code==='CONVERSATION_LIMIT'?409:code==="CHAT_UNAVAILABLE"||code==="QUEUE_UNAVAILABLE"?503:400,headers:noStore});
}
export async function GET(){
  try{
    const db=getDatabase(),token=(await cookies()).get(cookieName)?.value??null;
    const c=await scopedConversation(db,token);
    if(!c)return NextResponse.json({ok:true,conversation:null},{headers:noStore});
    const conversation=await publicConversation(db,c);
    if(conversation.pending)after(async()=>{if(!await enqueueAgent(db,c.id))await drainAgentJobs(db,c.id);});
    return NextResponse.json({ok:true,conversation},{headers:noStore});
  }catch(e){return errorResponse(e);}
}
export async function POST(request:Request){
  if(!trustedOrigin(request))return NextResponse.json({ok:false},{status:403,headers:noStore});
  try{
    const input=publicInboundSchema.parse(JSON.parse((await boundedBody(request,8000)).toString()));
    const db=getDatabase(),jar=await cookies(),existingToken=jar.get(cookieName)?.value??null;
    let c=await scopedConversation(db,existingToken);
    const ip=request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()??"local";
    const ipHash=createHash("sha256").update((process.env.BETTER_AUTH_SECRET??"")+ip).digest("hex");
    if(input.action==="start"){
      if(!c){const result=await startWebsiteConversation(db,input.locale,ipHash);c=result.conversation;jar.set(cookieName,result.token,{httpOnly:true,sameSite:"lax",secure:new URL(process.env.BETTER_AUTH_URL??request.url).protocol==="https:",path:"/api/chat",maxAge:30*86400});}
    }else{
      if(!c)throw new AgentError("INVALID_CONVERSATION");
      await rateLimit(db,`ip:${ipHash}`,30);
      await acceptMessage(db,c,input);
      if(!await enqueueAgent(db,c.id))after(()=>drainAgentJobs(db,c!.id));
    }
    return NextResponse.json({ok:true,conversation:await publicConversation(db,c)},{headers:noStore});
  }catch(e){return errorResponse(e);}
}
