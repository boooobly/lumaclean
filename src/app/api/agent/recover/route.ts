import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getDatabase } from "@/lib/database/client";
import { drainAgentJobs } from "@/lib/agent/runner";
import { enqueueAgent } from "@/lib/agent/queue";
import {recoverNotifications} from '@/lib/agent/notifications';
export const runtime="nodejs";
export const maxDuration=180;
export async function GET(request:Request){
  const expected=process.env.CRON_SECRET?`Bearer ${process.env.CRON_SECRET}`:null,actual=request.headers.get("authorization");
  if(!expected||!actual||actual.length!==expected.length||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected)))return NextResponse.json({ok:false},{status:401});
  const db=getDatabase();
  const jobs=await db.agentJob.findMany({where:{OR:[{status:'PENDING'},{status:'RUNNING',leaseUntil:{lt:new Date()}}]},select:{conversationId:true},distinct:['conversationId'],take:50});
  for(const job of jobs)await enqueueAgent(db,job.conversationId);
  await drainAgentJobs(db);await recoverNotifications(db);return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
