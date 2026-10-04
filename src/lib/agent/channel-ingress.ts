import {createHash,randomUUID} from 'node:crypto';
import type {PrismaClient} from '@/generated/prisma/client';
import {schedulingLock} from '@/lib/services/scheduling-commands';
import {AgentError} from './contracts';
import type {InboundEvent,StatusEvent} from './channels';
import {downloadChannelMedia} from './channel-media';
import {uploadAttachment,PrivateBlobStorage,attachmentPrefix,type ChatAttachmentStorage} from './chat-attachments';
export const inboundKey=(event:InboundEvent)=>createHash('sha256').update(`${event.channel}:${event.externalMessageId}`).digest('hex');
/** No name/username matching. Only the authenticated WhatsApp sender phone or an existing owner-verified mapping. */
export async function resolveChannelConversation(db:PrismaClient,event:InboundEvent){
 const verified=event.channel==='WHATSAPP'&&event.verifiedPhone===`+${event.externalUserId}`?await db.client.findMany({where:{normalizedPhone:event.verifiedPhone},select:{id:true},take:2}):[];
 return db.conversation.upsert({where:{channel_externalThreadId:{channel:event.channel,externalThreadId:event.externalThreadId}},create:{channel:event.channel,externalThreadId:event.externalThreadId,locale:event.locale,...(verified.length===1?{clientId:verified[0].id,identityVerified:true}:{})},update:{}});
}
export type ChannelMediaDependencies={request?:typeof fetch;storage?:ChatAttachmentStorage};
export async function channelAttachments(db:PrismaClient,conversationId:string,event:InboundEvent,dependencies:ChannelMediaDependencies={}){
 const ids:string[]=[],metadata:{kind:string;status:string;mime?:string}[]=[];
 if((event.attachments?.length??0)>4)throw new AgentError('ATTACHMENT_LIMIT');
 for(const [index,media] of (event.attachments??[]).entries()){
  const requestId=createHash('sha256').update(`${inboundKey(event)}:${index}`).digest('hex');
  const existing=await db.chatAttachment.findUnique({where:{conversationId_requestId:{conversationId,requestId}}});
  if(existing){ids.push(existing.id);metadata.push({kind:media.kind,status:'READY',mime:existing.mimeType});continue;}
  try{
   const {bytes,mime}=await downloadChannelMedia(event.channel as 'TELEGRAM'|'WHATSAPP'|'VIBER',media,dependencies.request);
   if(mime.startsWith('image/')){const row=await uploadAttachment(db,conversationId,requestId,bytes,mime,'CLIENT',dependencies.storage);ids.push(row.id);}
   else await db.$transaction(async tx=>{
    await schedulingLock(tx,'conversation',conversationId);
    const duplicate=await tx.chatAttachment.findUnique({where:{conversationId_requestId:{conversationId,requestId}}});if(duplicate){ids.push(duplicate.id);return;}
    if(await tx.chatAttachment.count({where:{conversationId,messageId:null}})>=12)throw new AgentError('ATTACHMENT_LIMIT');
    const key=`${attachmentPrefix()}${conversationId}/${requestId}.pdf`;
    await (dependencies.storage??new PrivateBlobStorage()).write(key,bytes);
    const row=await tx.chatAttachment.create({data:{id:randomUUID(),conversationId,requestId,storageKey:key,thumbnailKey:`${key}-unused`,mimeType:mime,byteSize:bytes.length,width:0,height:0,sha256:createHash('sha256').update(bytes).digest('hex'),aiAnalysisStatus:'NOT_ANALYZED'}});ids.push(row.id);
   },{timeout:20000});
   metadata.push({kind:mime.startsWith('image/')?'image':'document',status:'READY',mime});
  }catch(e){const code=e instanceof AgentError?e.code:'MEDIA_DOWNLOAD_FAILED';if(['MEDIA_PROVIDER_UNAVAILABLE','MEDIA_DOWNLOAD_FAILED'].includes(code))throw new AgentError(code);metadata.push({kind:media.kind,status:code});}
 }return{ids,metadata};
}
const ranks:Record<string,number>={PENDING:0,SENDING:0,UNKNOWN:0,SENT:1,FAILED:1,DELIVERED:2,READ:3};
export async function applyChannelStatus(db:PrismaClient,event:StatusEvent){
 if(event.channel==='TELEGRAM')return; // Bot API exposes acceptance, never delivered/read receipts.
 if(!Number.isFinite(event.at.getTime())||event.at.getTime()>Date.now()+300000)return;
 const c=await db.conversation.findUnique({where:{channel_externalThreadId:{channel:event.channel,externalThreadId:event.externalThreadId}}});if(!c)return;
 await db.$transaction(async tx=>{
  await schedulingLock(tx,'conversation',c.id);
  const row=await tx.message.findFirst({where:{conversationId:c.id,channelMessageId:event.externalMessageId,author:{in:['AI','ADMIN','SYSTEM']}}});if(!row){if(await tx.message.count({where:{conversationId:c.id,deliveryStatus:'SENDING'}}))throw new AgentError('STATUS_WAITING_SEND');return;}
  if((ranks[event.status]??0)<(ranks[row.deliveryStatus]??0)||row.deliveryStatus==='CANCELLED'||row.deliveryStatus==='FAILED'&&event.status==='SENT'||row.deliveryStatus===event.status&&row.deliveryUpdatedAt&&row.deliveryUpdatedAt>event.at)return;
  await tx.message.update({where:{id:row.id},data:{deliveryStatus:event.status,deliveryUpdatedAt:event.at,deliveryError:event.errorCode??null,...(event.status==='READ'?{readAt:event.at}:{}) ,...(event.status==='DELIVERED'?{deliveredAt:event.at}:{})}});
  if(event.status==='FAILED')await tx.conversation.update({where:{id:c.id},data:{needsAttention:true}});
 });
}
