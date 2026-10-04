import {z} from 'zod';
import {AgentError} from './contracts';
import type {InboundEvent,StatusEvent,ChannelMedia} from './customer-channels';
const identifier=z.string().min(1).max(200);
const file=z.object({file_id:identifier,file_size:z.number().int().nonnegative().optional(),mime_type:z.string().max(1000).optional()});
const locale=(value?:string)=>value?.startsWith('ru')?'ru':value?.startsWith('sr')?'sr-Latn':'en';
export function normalizeTelegram(raw:unknown):InboundEvent|null{
 const envelope=z.object({update_id:z.number().int().nonnegative(),message:z.unknown().optional()}).safeParse(raw);
 if(!envelope.success)throw new AgentError('INVALID_TELEGRAM_UPDATE');
 const shape=z.object({message_id:z.number().int().positive(),date:z.number().int().optional(),text:z.string().max(4096).optional(),caption:z.string().max(1024).optional(),photo:z.array(file).max(20).optional(),document:file.optional(),reply_to_message:z.object({message_id:z.number().int()}).optional(),chat:z.object({id:z.number().int().positive(),type:z.literal('private')}),from:z.object({id:z.number().int().positive(),is_bot:z.literal(false),language_code:z.string().max(20).optional()})}).safeParse(envelope.data.message);
 if(!shape.success){const candidate=envelope.data.message as {chat?:{type?:string}}|undefined;if(!candidate||candidate.chat?.type!=='private')return null;throw new AgentError('INVALID_TELEGRAM_UPDATE');}
 const m=shape.data;if(m.chat.id!==m.from.id)throw new AgentError('PRIVATE_CHAT_REQUIRED');
 const photo=m.photo?.at(-1),media=photo??m.document;
 const attachments:ChannelMedia[]=media?[{kind:photo?'image':media.mime_type?.startsWith('image/')?'image':'document',id:media.file_id,mime:photo?'image/jpeg':media.mime_type,size:media.file_size}]:[];
 return{channel:'TELEGRAM',externalThreadId:String(m.chat.id),externalUserId:String(m.from.id),externalMessageId:`${m.chat.id}:${m.message_id}`,text:m.text?.trim()??m.caption?.trim()??(media?'[Вложение]':'[Неподдерживаемое сообщение]'),locale:locale(m.from.language_code),receivedAt:new Date(),providerSentAt:m.date?new Date(m.date*1000):undefined,replyTo:m.reply_to_message?String(m.reply_to_message.message_id):undefined,attachments};
}
export function normalizeWhatsApp(raw:unknown):{messages:InboundEvent[];statuses:StatusEvent[]}{
 const payload=z.object({object:z.literal('whatsapp_business_account'),entry:z.array(z.object({id:identifier,changes:z.array(z.object({field:z.string(),value:z.object({metadata:z.object({phone_number_id:identifier}),messages:z.array(z.object({id:identifier,from:z.string().regex(/^\d{6,15}$/),timestamp:z.string().regex(/^\d{1,13}$/),type:z.string(),text:z.object({body:z.string().max(4096)}).optional(),image:z.object({id:identifier,mime_type:z.string().optional(),caption:z.string().max(1024).optional()}).optional(),document:z.object({id:identifier,mime_type:z.string().optional(),caption:z.string().max(1024).optional()}).optional(),context:z.object({id:identifier}).optional()})).max(1000).optional(),statuses:z.array(z.object({id:identifier,recipient_id:identifier,status:z.enum(['sent','delivered','read','failed']),timestamp:z.string().regex(/^\d{1,13}$/),errors:z.array(z.object({code:z.number()})).optional()})).max(1000).optional()})})).max(1000)})).max(1000)}).parse(raw);
 const messages:InboundEvent[]=[],statuses:StatusEvent[]=[];
 for(const entry of payload.entry){if(entry.id!==process.env.WHATSAPP_BUSINESS_ACCOUNT_ID)continue;for(const change of entry.changes){const v=change.value;if(change.field!=='messages'||v.metadata.phone_number_id!==process.env.WHATSAPP_PHONE_NUMBER_ID)continue;
  for(const m of v.messages??[]){const media=m.image??m.document;messages.push({channel:'WHATSAPP',externalThreadId:m.from,externalUserId:m.from,externalMessageId:m.id,text:m.text?.body??media?.caption??(media?'[Вложение]':'[Неподдерживаемое сообщение]'),locale:'ru',receivedAt:new Date(),providerSentAt:new Date(Number(m.timestamp)*1000),replyTo:m.context?.id,verifiedPhone:`+${m.from}`,attachments:media?[{kind:m.image?'image':'document',id:media.id,mime:media.mime_type}]:[]});}
  for(const s of v.statuses??[])statuses.push({channel:'WHATSAPP',externalThreadId:s.recipient_id,externalMessageId:s.id,status:s.status.toUpperCase() as StatusEvent['status'],at:new Date(Number(s.timestamp)*1000),errorCode:s.errors?.[0]?`WHATSAPP_${s.errors[0].code}`:undefined});
 }}return{messages,statuses};
}
export function normalizeViber(raw:unknown):{messages:InboundEvent[];statuses:StatusEvent[]}{
 const v=z.object({event:z.string().max(40),timestamp:z.number().int().nonnegative(),message_token:z.string().max(40),sender:z.object({id:identifier,language:z.string().optional()}).optional(),user_id:identifier.optional(),message:z.object({type:z.string(),text:z.string().max(7000).optional(),media:z.string().max(2000).optional(),size:z.number().int().nonnegative().optional()}).optional()}).parse(raw);
 if(['delivered','seen','failed'].includes(v.event)&&v.user_id)return{messages:[],statuses:[{channel:'VIBER',externalThreadId:v.user_id,externalMessageId:v.message_token,status:v.event==='seen'?'READ':v.event==='delivered'?'DELIVERED':'FAILED',at:new Date(v.timestamp),errorCode:v.event==='failed'?'VIBER_DELIVERY_FAILED':undefined}]};
 if(v.event!=='message'||!v.sender||!v.message)return{messages:[],statuses:[]};
 const m=v.message;return{messages:[{channel:'VIBER',externalThreadId:v.sender.id,externalUserId:v.sender.id,externalMessageId:v.message_token,text:m.text??'[Вложение]',locale:locale(v.sender.language),receivedAt:new Date(),providerSentAt:new Date(v.timestamp),attachments:m.media?[{kind:m.type==='picture'?'image':m.type==='file'?'document':'unsupported',url:m.media,size:m.size}]:[]}],statuses:[]};
}
