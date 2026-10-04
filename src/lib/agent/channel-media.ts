import {z} from 'zod';
import {AgentError} from './contracts';
import type {CustomerChannel,ChannelMedia} from './customer-channels';
import {boundedBody} from '@/lib/services/admin-http';
export const CHANNEL_FILE_MAX=4*1024*1024;
export function safeMediaUrl(channel:CustomerChannel,value:string){
 const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port)throw new AgentError('UNSAFE_MEDIA_URL');
 const host=url.hostname.toLowerCase(),allowed=channel==='TELEGRAM'?host==='api.telegram.org':channel==='WHATSAPP'?host==='lookaside.fbsbx.com':host.endsWith('.viber.com')||host.endsWith('.viber.net');
 if(!allowed)throw new AgentError('UNSAFE_MEDIA_URL');return url;
}
export async function downloadChannelMedia(channel:CustomerChannel,media:ChannelMedia,request:typeof fetch=fetch){
 if(media.kind==='unsupported')throw new AgentError('UNSUPPORTED_ATTACHMENT');
 if(media.size&&media.size>CHANNEL_FILE_MAX)throw new AgentError('ATTACHMENT_TOO_LARGE');
 let url:string,headers:HeadersInit|undefined;
 const options={signal:AbortSignal.timeout(10000),redirect:'error' as const,cache:'no-store' as const};
 try{
  if(channel==='TELEGRAM'){
   if(!media.id)throw new AgentError('INVALID_MEDIA_ID');
   const response=await request(`https://api.telegram.org/bot${process.env.TELEGRAM_CUSTOMER_BOT_TOKEN}/getFile`,{...options,method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({file_id:media.id})});
   if(!response.ok)throw new AgentError('MEDIA_PROVIDER_UNAVAILABLE');
   const value=z.object({ok:z.literal(true),result:z.object({file_path:z.string().regex(/^[\w./-]+$/),file_size:z.number().nonnegative().optional()})}).parse(await response.json());
   if((value.result.file_size??0)>CHANNEL_FILE_MAX)throw new AgentError('ATTACHMENT_TOO_LARGE');
   if(value.result.file_path.split('/').includes('..'))throw new AgentError('UNSAFE_MEDIA_URL');
   url=`https://api.telegram.org/file/bot${process.env.TELEGRAM_CUSTOMER_BOT_TOKEN}/${value.result.file_path}`;
  }else if(channel==='WHATSAPP'){
   if(!media.id||!/^\d{1,40}$/.test(media.id))throw new AgentError('INVALID_MEDIA_ID');
   headers={Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`};
   const response=await request(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${media.id}`,{...options,headers});
   if(!response.ok)throw new AgentError('MEDIA_PROVIDER_UNAVAILABLE');
   const value=z.object({url:z.string(),mime_type:z.string(),file_size:z.number().nonnegative()}).parse(await response.json());if(value.file_size>CHANNEL_FILE_MAX)throw new AgentError('ATTACHMENT_TOO_LARGE');url=value.url;media={...media,mime:value.mime_type};
  }else{if(!media.url)throw new AgentError('INVALID_MEDIA_ID');url=media.url;}
  const response=await request(safeMediaUrl(channel,url),{...options,headers});if(!response.ok)throw new AgentError('MEDIA_PROVIDER_UNAVAILABLE');
  // A bounded stream is used even if Content-Length is omitted or forged.
  const bytes=await boundedBody(new Request('https://media.invalid',{method:'POST',headers:response.headers,body:response.body,duplex:'half'} as RequestInit),CHANNEL_FILE_MAX);
  const mime=(media.mime??response.headers.get('content-type')??'').split(';')[0];
  if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(mime))throw new AgentError('UNSUPPORTED_ATTACHMENT');
  if(mime==='application/pdf'&&(!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(-2048).includes(Buffer.from('%%EOF'))))throw new AgentError('INVALID_DOCUMENT');
  return{bytes,mime};
 }catch(e){if(e instanceof AgentError)throw e;throw new AgentError('MEDIA_DOWNLOAD_FAILED');}
}
