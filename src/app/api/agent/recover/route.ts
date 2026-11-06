import { NextResponse } from "next/server";
import {authorizedCron} from '@/lib/services/cron-auth';
import { getDatabase } from "@/lib/database/client";
import { drainAgentJobs } from "@/lib/agent/runner";
import { enqueueAgent } from "@/lib/agent/queue";
import {recoverNotifications} from '@/lib/agent/notifications';
import {cleanupAttachments} from '@/lib/agent/chat-attachments';
export const runtime="nodejs";
export const maxDuration=180;
export async function GET(request:Request){
  if(!authorizedCron(request))return NextResponse.json({ok:false},{status:401,headers:{'Cache-Control':'private, no-store'}});
  const db=getDatabase();
  const jobs=await db.agentJob.findMany({where:{OR:[{status:'PENDING'},{status:'RUNNING',leaseUntil:{lt:new Date()}}]},select:{conversationId:true},distinct:['conversationId'],take:50});
  for(const job of jobs){try{await enqueueAgent(db,job.conversationId);}catch{/* DB jobs are drained below. */}}
  const outbox=await db.message.findMany({where:{deliveryStatus:{in:['PENDING','SENDING']}},select:{conversationId:true},distinct:['conversationId'],take:50});
  for(const row of outbox)if(!jobs.some(j=>j.conversationId===row.conversationId)){try{await enqueueAgent(db,row.conversationId);}catch{/* DB outbox is drained below. */}}
  try{await drainAgentJobs(db);}finally{await recoverNotifications(db);}if(process.env.BLOB_READ_WRITE_TOKEN)await cleanupAttachments(db);return NextResponse.json({ok:true},{headers:{"Cache-Control":"no-store"}});
}
