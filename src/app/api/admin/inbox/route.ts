import { after, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { boundedBody, adminRateLimit } from "@/lib/services/admin-http";
import { AgentError } from "@/lib/agent/contracts";
import { inboxCommandSchema, runInboxCommand } from "@/lib/agent/inbox";
import { drainAgentJobs } from "@/lib/agent/runner";
import { enqueueAgent } from "@/lib/agent/queue";
export const runtime="nodejs";
export const maxDuration=180;
export async function POST(request:Request){
  const origin=request.headers.get("origin");
  if(!origin||![process.env.BETTER_AUTH_URL,process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:null].includes(origin)||!request.headers.get("content-type")?.startsWith("application/json"))return NextResponse.json({ok:false},{status:403});
  try{
    const user=await getCurrentUser();if(!user)return NextResponse.json({ok:false},{status:401});if(user.role!=="ADMIN")return NextResponse.json({ok:false},{status:403});
    await adminRateLimit(user.id,"inbox",40);
    const payload=inboxCommandSchema.parse(JSON.parse((await boundedBody(request,15000)).toString()));
    const db=getDatabase();await runInboxCommand(db,user.id,payload);
    if(payload.action==="reply"||payload.action==="retry"||payload.action==="resume")if(!await enqueueAgent(db,payload.id))after(()=>drainAgentJobs(db,payload.id));
    revalidatePath("/admin","layout");
    return NextResponse.json({ok:true},{headers:{"Cache-Control":"private, no-store"}});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof AgentError?e.code:"Проверьте запрос или повторите позже."},{status:e instanceof AgentError&&e.code==="FORBIDDEN"?403:400});}
}
