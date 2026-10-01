import {send} from '@vercel/queue';
import type {PrismaClient} from '@/generated/prisma/client';
import {z} from 'zod';
import {AgentError} from './contracts';
import {drainAgentJobs} from './runner';
export const queuePayload=z.object({conversationId:z.string().min(1).max(80)}).strict();
/** Commit the database job first, then publish an opaque wake-up before acknowledging ingress. */
export async function enqueueAgent(db:PrismaClient,conversationId:string){
  if(process.env.VERCEL!=='1')return false;
  const c=await db.conversation.findUniqueOrThrow({where:{id:conversationId},select:{revision:true}});
  try{await send('lumaclean-agent',{conversationId},{idempotencyKey:`${conversationId}:${c.revision}`,retentionSeconds:86400});return true;}
  catch{throw new AgentError('QUEUE_UNAVAILABLE');}
}
export async function consumeAgentWake(db:PrismaClient,payload:unknown){
  const {conversationId}=queuePayload.parse(payload);
  await drainAgentJobs(db,conversationId);
  // Another delivery may own a live lease. Do not acknowledge while work remains.
  if(await db.agentJob.count({where:{conversationId,status:{in:['PENDING','RUNNING']}}}))throw new AgentError('AGENT_WORK_REMAINS');
  if(await db.message.count({where:{conversationId,deliveryStatus:{in:['PENDING','SENDING']}}}))throw new AgentError('DELIVERY_WORK_REMAINS');
}
