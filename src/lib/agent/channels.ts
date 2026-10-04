import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { AgentError } from "./contracts";

export type InboundEvent={channel:"WEBSITE"|"TELEGRAM"|"WHATSAPP"|"VIBER";externalThreadId:string;externalMessageId:string;text:string;locale:string};
export type OutboundEvent={id:string;externalThreadId:string;text:string};
export type DeliveryResult={status:"DELIVERED"|"FAILED"|"UNKNOWN";externalMessageId?:string;errorCode?:string};
export interface ChannelAdapter {send(event:OutboundEvent):Promise<DeliveryResult>;deliveryStatus?(externalMessageId:string):Promise<DeliveryResult>;}
export class WebsiteAdapter implements ChannelAdapter {async send(){return{status:"DELIVERED" as const};}}
export class DisabledChannelAdapter implements ChannelAdapter {async send(){return{status:"FAILED" as const,errorCode:"OFFICIAL_CHANNEL_UNCONFIGURED"};}}
export class TelegramCustomerAdapter implements ChannelAdapter {
  constructor(private token=process.env.TELEGRAM_CUSTOMER_BOT_TOKEN??"",private sendRequest:typeof fetch=fetch){}
  async send(event:OutboundEvent):Promise<DeliveryResult>{
    if(!this.token)return{status:"FAILED",errorCode:"CUSTOMER_BOT_UNCONFIGURED"};
    if(!/^[1-9]\d{0,15}$/.test(event.externalThreadId))return{status:"FAILED",errorCode:"PRIVATE_CHAT_REQUIRED"};
    try{
      const response=await this.sendRequest(`https://api.telegram.org/bot${this.token}/sendMessage`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:event.externalThreadId,text:event.text.slice(0,3900),protect_content:true}),signal:AbortSignal.timeout(10000),cache:"no-store"});
      if(response.status>=500)return{status:"UNKNOWN",errorCode:"DELIVERY_OUTCOME_UNKNOWN"};
      if(response.status===429)return{status:'FAILED',errorCode:'TELEGRAM_RATE_LIMIT'};
      const result=z.object({ok:z.boolean(),result:z.object({message_id:z.number().int()}).optional()}).safeParse(await response.json());
      if(response.ok&&result.success&&result.data.ok&&result.data.result)return{status:"DELIVERED",externalMessageId:String(result.data.result.message_id)};
      return{status:"FAILED",errorCode:"TELEGRAM_REJECTED"};
    }catch{return{status:"UNKNOWN",errorCode:"DELIVERY_OUTCOME_UNKNOWN"};}
  }
}
export function channelAdapter(channel:string):ChannelAdapter{return channel==="WEBSITE"?new WebsiteAdapter():channel==="TELEGRAM"?new TelegramCustomerAdapter():new DisabledChannelAdapter();}
export function customerTelegramConfigured(){return !!process.env.TELEGRAM_CUSTOMER_BOT_TOKEN&&!!process.env.TELEGRAM_CUSTOMER_WEBHOOK_SECRET&&process.env.TELEGRAM_CUSTOMER_BOT_TOKEN!==process.env.TELEGRAM_BOT_TOKEN;}
export function verifyWebhookSecret(actual:string|null){
  const expected=process.env.TELEGRAM_CUSTOMER_WEBHOOK_SECRET;
  if(!customerTelegramConfigured()||!expected||!actual||actual.length!==expected.length)return false;
  return timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
const telegramSchema=z.object({update_id:z.number().int().nonnegative(),message:z.object({message_id:z.number().int(),text:z.string().trim().min(1).max(1500),chat:z.object({id:z.number().int().positive(),type:z.literal("private")}),from:z.object({id:z.number().int().positive(),is_bot:z.literal(false),language_code:z.string().max(20).optional()})}).optional()});
export function normalizeTelegram(raw:unknown):InboundEvent|null{
  const envelope=z.object({update_id:z.number().int().nonnegative(),message:z.unknown().optional()}).safeParse(raw);
  if(!envelope.success)throw new AgentError("INVALID_TELEGRAM_UPDATE");
  // Valid updates such as photos, service messages and groups are acknowledged and ignored.
  const supported=z.object({text:z.string(),chat:z.object({type:z.literal("private")}),from:z.object({is_bot:z.literal(false)})}).safeParse(envelope.data.message);
  if(!supported.success)return null;
  const parsed=telegramSchema.safeParse(raw);if(!parsed.success)throw new AgentError("INVALID_TELEGRAM_UPDATE");
  const m=parsed.data.message;if(!m)return null;
  if(m.from.id!==m.chat.id)throw new AgentError("PRIVATE_CHAT_REQUIRED");
  return{channel:"TELEGRAM",externalThreadId:String(m.chat.id),externalMessageId:String(parsed.data.update_id),text:m.text,locale:m.from.language_code?.startsWith("ru")?"ru":m.from.language_code?.startsWith("sr")?"sr-Latn":"en"};
}
