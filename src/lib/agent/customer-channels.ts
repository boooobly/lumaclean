import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {outboundMediaUrl} from './channel-media-ticket';
export {normalizeTelegram,normalizeWhatsApp,normalizeViber} from './channel-normalization';
export type CustomerChannel='TELEGRAM'|'WHATSAPP'|'VIBER';
export type ChannelMedia={kind:'image'|'document'|'unsupported';id?:string;url?:string;mime?:string;size?:number};
export type InboundEvent={channel:'WEBSITE'|CustomerChannel;externalThreadId:string;externalUserId?:string;externalMessageId:string;text:string;locale:string;receivedAt?:Date;providerSentAt?:Date;replyTo?:string;attachments?:ChannelMedia[];verifiedPhone?:string};
export type OutboundEvent={id:string;externalThreadId:string;text:string;lastInboundAt?:Date;attachment?:{id:string;bytes:Buffer;mime:string}};
export type DeliveryResult={status:'SENT'|'DELIVERED'|'READ'|'FAILED'|'UNKNOWN';externalMessageId?:string;errorCode?:string;retryAfterSeconds?:number;retryable?:boolean};
export type StatusEvent={channel:CustomerChannel;externalThreadId:string;externalMessageId:string;status:'SENT'|'DELIVERED'|'READ'|'FAILED';at:Date;errorCode?:string};
export interface ChannelAdapter {send(event:OutboundEvent):Promise<DeliveryResult>;deliveryStatus?(externalMessageId:string):Promise<DeliveryResult>;}
export class WebsiteAdapter implements ChannelAdapter {async send(){return{status:'DELIVERED' as const};}}
export class DisabledChannelAdapter implements ChannelAdapter {async send(){return{status:'FAILED' as const,errorCode:'OFFICIAL_CHANNEL_UNCONFIGURED'};}}
const unknown=():DeliveryResult=>({status:'UNKNOWN',errorCode:'DELIVERY_OUTCOME_UNKNOWN'});
const rejected=(errorCode:string,retryable=false,retryAfterSeconds?:number):DeliveryResult=>({status:'FAILED',errorCode,retryable,retryAfterSeconds});
export const channelCredentialNames={TELEGRAM:['TELEGRAM_CUSTOMER_BOT_TOKEN','TELEGRAM_CUSTOMER_WEBHOOK_SECRET'],WHATSAPP:['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_BUSINESS_ACCOUNT_ID','WHATSAPP_APP_SECRET','WHATSAPP_VERIFY_TOKEN','WHATSAPP_GRAPH_VERSION'],VIBER:['VIBER_CUSTOMER_BOT_TOKEN']} as const;
export function customerTelegramConfigured(){return !!process.env.TELEGRAM_CUSTOMER_BOT_TOKEN&&!!process.env.TELEGRAM_CUSTOMER_WEBHOOK_SECRET&&process.env.TELEGRAM_CUSTOMER_BOT_TOKEN!==process.env.TELEGRAM_BOT_TOKEN;}
export function channelConfiguration(channel:CustomerChannel){
 const missing=channelCredentialNames[channel].filter(k=>!process.env[k]?.trim()),errors:string[]=[];
 if(channel==='TELEGRAM'&&process.env.TELEGRAM_CUSTOMER_BOT_TOKEN&&process.env.TELEGRAM_CUSTOMER_BOT_TOKEN===process.env.TELEGRAM_BOT_TOKEN)errors.push('CUSTOMER_BOT_MUST_DIFFER_FROM_ADMIN_BOT');
 if(channel==='WHATSAPP'&&((process.env.WHATSAPP_PHONE_NUMBER_ID&&!/^\d{5,30}$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID))||(process.env.WHATSAPP_GRAPH_VERSION&&!/^v\d{2,3}\.0$/.test(process.env.WHATSAPP_GRAPH_VERSION))))errors.push('INVALID_META_CONFIGURATION');
 return{configured:!missing.length&&!errors.length,missing,errors};
}
function equalSecret(a:string|null,b:string|undefined){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
export function verifyWebhookSecret(actual:string|null){return customerTelegramConfigured()&&equalSecret(actual,process.env.TELEGRAM_CUSTOMER_WEBHOOK_SECRET);}
export function verifySignature(channel:'WHATSAPP'|'VIBER',body:Buffer,actual:string|null){const key=channel==='WHATSAPP'?process.env.WHATSAPP_APP_SECRET:process.env.VIBER_CUSTOMER_BOT_TOKEN;if(!key||!actual||channel==='WHATSAPP'&&!actual.startsWith('sha256='))return false;const value=channel==='WHATSAPP'?actual.replace(/^sha256=/,''):actual;return /^[a-f0-9]{64}$/i.test(value)&&equalSecret(value.toLowerCase(),createHmac('sha256',key).update(body).digest('hex'));}
export function verifyWhatsAppChallenge(url:URL){return url.searchParams.get('hub.mode')==='subscribe'&&equalSecret(url.searchParams.get('hub.verify_token'),process.env.WHATSAPP_VERIFY_TOKEN)&&/^\d{1,100}$/.test(url.searchParams.get('hub.challenge')??'')?url.searchParams.get('hub.challenge'):null;}
/** Preserve Viber's 64-bit message identifiers before JSON loses their precision. */
export function parseProviderJson(text:string){return JSON.parse(text.replace(/("message_token"\s*:\s*)(\d+)/g,'$1"$2"'));}
export class TelegramCustomerAdapter implements ChannelAdapter {
 constructor(private token=process.env.TELEGRAM_CUSTOMER_BOT_TOKEN??'',private request:typeof fetch=fetch){}
 async send(event:OutboundEvent):Promise<DeliveryResult>{
  if(!this.token||this.token===process.env.TELEGRAM_BOT_TOKEN)return rejected('CUSTOMER_BOT_UNCONFIGURED');
  if(!/^[1-9]\d{0,15}$/.test(event.externalThreadId))return rejected('PRIVATE_CHAT_REQUIRED');
  if(event.text.length>4096)return rejected('MESSAGE_TOO_LONG');
  try{
   let body:BodyInit,method='sendMessage',headers:HeadersInit|undefined={'Content-Type':'application/json'};
   if(event.attachment){method=event.attachment.mime.startsWith('image/')?'sendPhoto':'sendDocument';const form=new FormData();form.set('chat_id',event.externalThreadId);form.set(method==='sendPhoto'?'photo':'document',new Blob([new Uint8Array(event.attachment.bytes)],{type:event.attachment.mime}),method==='sendPhoto'?'photo.jpg':'document.pdf');form.set('protect_content','true');if(event.text){if(event.text.length>1024)return rejected('CAPTION_TOO_LONG');form.set('caption',event.text);}body=form;headers=undefined;}
   else body=JSON.stringify({chat_id:event.externalThreadId,text:event.text,protect_content:true});
   const response=await this.request(`https://api.telegram.org/bot${this.token}/${method}`,{method:'POST',headers,body,signal:AbortSignal.timeout(10000),cache:'no-store'});
   if(response.status>=500)return unknown();
   const result=z.object({ok:z.boolean(),result:z.object({message_id:z.number().int()}).optional(),parameters:z.object({retry_after:z.number().optional()}).optional()}).safeParse(await response.json());
   if(response.status===429)return rejected('TELEGRAM_RATE_LIMIT',true,result.success?result.data.parameters?.retry_after:undefined);
   if(response.ok&&result.success&&result.data.ok&&result.data.result)return{status:'SENT',externalMessageId:String(result.data.result.message_id)};
   return rejected('TELEGRAM_REJECTED');
  }catch{return unknown();}
 }
}
export class WhatsAppCustomerAdapter implements ChannelAdapter {
 constructor(private request:typeof fetch=fetch){}
 async send(event:OutboundEvent):Promise<DeliveryResult>{
  if(!channelConfiguration('WHATSAPP').configured)return rejected('WHATSAPP_UNCONFIGURED');
  if(!/^\d{6,15}$/.test(event.externalThreadId))return rejected('INVALID_RECIPIENT');
  if(!event.lastInboundAt||Date.now()-event.lastInboundAt.getTime()>86400000)return rejected('WHATSAPP_TEMPLATE_REQUIRED');
  if(event.text.length>4096)return rejected('MESSAGE_TOO_LONG');
  if(event.attachment&&event.text.length>1024)return rejected('CAPTION_TOO_LONG');
  let content:Record<string,unknown>={type:'text',text:{body:event.text,preview_url:false}};
  if(event.attachment){try{const form=new FormData();form.set('messaging_product','whatsapp');form.set('file',new Blob([new Uint8Array(event.attachment.bytes)],{type:event.attachment.mime}),event.attachment.mime.startsWith('image/')?'photo.jpg':'document.pdf');const response=await this.request(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/media`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`},body:form,signal:AbortSignal.timeout(10000),cache:'no-store'});if(!response.ok)return rejected('WHATSAPP_MEDIA_UPLOAD_FAILED',response.status===429||response.status>=500,60);const media=z.object({id:z.string().min(1)}).parse(await response.json()),type=event.attachment.mime.startsWith('image/')?'image':'document';content={type,[type]:{id:media.id,...(event.text?{caption:event.text}:{}),...(type==='document'?{filename:'document.pdf'}:{})}};}catch{return rejected('WHATSAPP_MEDIA_UPLOAD_FAILED',true,60);}}
  try{
   const response=await this.request(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:`+${event.externalThreadId}`,...content,biz_opaque_callback_data:event.id}),signal:AbortSignal.timeout(10000),cache:'no-store'});
   if(response.status>=500)return unknown();
   const value=z.object({messages:z.array(z.object({id:z.string()})).optional(),error:z.object({code:z.number().optional()}).optional()}).safeParse(await response.json()),code=value.success?value.data.error?.code:undefined;
   if(response.status===429||code===130429||code===131056||code===80007)return rejected('WHATSAPP_RATE_LIMIT',true,60);
   if(response.ok&&value.success&&value.data.messages?.[0])return{status:'SENT',externalMessageId:value.data.messages[0].id};
   return rejected(code?`WHATSAPP_${code}`:'WHATSAPP_REJECTED');
  }catch{return unknown();}
 }
}
export class ViberCustomerAdapter implements ChannelAdapter {
 constructor(private request:typeof fetch=fetch){}
 async send(event:OutboundEvent):Promise<DeliveryResult>{
  if(!channelConfiguration('VIBER').configured)return rejected('VIBER_UNCONFIGURED');
  if(!/^[\w+/=-]{1,100}$/.test(event.externalThreadId))return rejected('INVALID_RECIPIENT');
  if(event.text.length>7000)return rejected('MESSAGE_TOO_LONG');
  try{
   const media=event.attachment,content=media?media.mime.startsWith('image/')?{type:'picture',media:outboundMediaUrl(media.id),text:event.text}:{type:'file',media:outboundMediaUrl(media.id),size:media.bytes.length,file_name:'document.pdf'}:{type:'text',text:event.text};
   if(media&&!media.mime.startsWith('image/')&&event.text)return rejected('DOCUMENT_CAPTION_UNSUPPORTED');
   const response=await this.request('https://chatapi.viber.com/pa/send_message',{method:'POST',headers:{'X-Viber-Auth-Token':process.env.VIBER_CUSTOMER_BOT_TOKEN!,'Content-Type':'application/json'},body:JSON.stringify({receiver:event.externalThreadId,sender:{name:'LumaClean'},...content,tracking_data:event.id}),signal:AbortSignal.timeout(10000),cache:'no-store'});
   if(response.status>=500)return unknown();if(response.status===429)return rejected('VIBER_RATE_LIMIT',true,60);
   const value=z.object({status:z.number(),message_token:z.string().optional()}).safeParse(parseProviderJson(await response.text()));
   if(response.ok&&value.success&&value.data.status===0&&value.data.message_token)return{status:'SENT',externalMessageId:value.data.message_token};
   if(value.success&&value.data.status===12)return rejected('VIBER_RATE_LIMIT',true,60);
   return rejected(value.success?`VIBER_${value.data.status}`:'VIBER_REJECTED');
  }catch{return unknown();}
 }
}
export function channelAdapter(channel:string):ChannelAdapter{return channel==='WEBSITE'?new WebsiteAdapter():channel==='TELEGRAM'?new TelegramCustomerAdapter():channel==='WHATSAPP'?new WhatsAppCustomerAdapter():channel==='VIBER'?new ViberCustomerAdapter():new DisabledChannelAdapter();}
