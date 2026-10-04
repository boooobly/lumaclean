import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Prisma,PrismaClient,BusinessSettings} from '@/generated/prisma/client';
import {channelConfiguration,channelCredentialNames,type CustomerChannel} from './channels';
import {AgentError} from './contracts';
export const customerChannels=['TELEGRAM','WHATSAPP','VIBER'] as const;
type Probe={ok:boolean;code:string;at:string;fingerprint:string;lastWebhookAt?:string};
export const channelFingerprint=(channel:CustomerChannel)=>createHash('sha256').update(JSON.stringify(channelCredentialNames[channel].map(k=>process.env[k]??''))).digest('hex');
export function channelReady(settings:Pick<BusinessSettings,'customerChannelDiagnostics'>,channel:CustomerChannel){const probe=(settings.customerChannelDiagnostics as Record<string,Probe>)[channel];return channelConfiguration(channel).configured&&!!probe?.ok&&probe.fingerprint===channelFingerprint(channel)&&Number.isFinite(Date.parse(probe.at))&&Date.parse(probe.at)<=Date.now()+300000;}
export async function testChannelConnection(db:PrismaClient,channel:CustomerChannel,request:typeof fetch=fetch){
 let ok=false,code='CREDENTIALS_MISSING';
 if(channelConfiguration(channel).configured)try{
  const options={signal:AbortSignal.timeout(10000),cache:'no-store' as const,redirect:'error' as const};
  if(channel==='TELEGRAM'){
   const [me,webhook]=await Promise.all([request(`https://api.telegram.org/bot${process.env.TELEGRAM_CUSTOMER_BOT_TOKEN}/getMe`,options),request(`https://api.telegram.org/bot${process.env.TELEGRAM_CUSTOMER_BOT_TOKEN}/getWebhookInfo`,options)]);
   const m=z.object({ok:z.literal(true),result:z.object({is_bot:z.literal(true)})}).parse(await me.json()),w=z.object({ok:z.literal(true),result:z.object({url:z.string()})}).parse(await webhook.json());
   ok=!!m.result.is_bot&&w.result.url===`${channelBaseUrl()}/api/channels/telegram`;code=ok?'CONNECTED':'WEBHOOK_NOT_CONFIGURED';
  }else if(channel==='WHATSAPP'){
   const response=await request(`https://graph.facebook.com/${process.env.WHATSAPP_GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}?fields=id,verified_name`,{...options,headers:{Authorization:`Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`}});
   const value=z.object({id:z.string(),verified_name:z.string().min(1)}).parse(await response.json());
   const inbound=await db.message.count({where:{conversation:{channel},author:'CLIENT',receivedAt:{gte:new Date(Date.now()-86400000)}}});
   ok=response.ok&&value.id===process.env.WHATSAPP_PHONE_NUMBER_ID&&inbound>0;code=ok?'CONNECTED':'AUTHENTICATED_AWAITING_INBOUND';
  }else{
   const response=await request('https://chatapi.viber.com/pa/get_account_info',{...options,method:'POST',headers:{'X-Viber-Auth-Token':process.env.VIBER_CUSTOMER_BOT_TOKEN!,'Content-Type':'application/json'},body:'{}'});
   const value=z.object({status:z.literal(0),webhook:z.string()}).parse(await response.json());ok=response.ok&&value.webhook===`${channelBaseUrl()}/api/channels/viber`;code=ok?'CONNECTED':'WEBHOOK_NOT_CONFIGURED';
  }
 }catch{code='PROVIDER_UNAVAILABLE';}
 const probe:Probe={ok,code,at:new Date().toISOString(),fingerprint:channelFingerprint(channel)};
 await db.$transaction(async tx=>{await tx.$queryRaw`SELECT id FROM "BusinessSettings" WHERE id='default' FOR UPDATE`;const s=await tx.businessSettings.findUniqueOrThrow({where:{id:'default'}});await tx.businessSettings.update({where:{id:'default'},data:{customerChannelDiagnostics:{...s.customerChannelDiagnostics as object,[channel]:{...(s.customerChannelDiagnostics as Record<string,Probe>)[channel],...probe}}}});});
 return{ok,code};
}
export function channelBaseUrl(){if(process.env.VERCEL_ENV==='preview'&&process.env.VERCEL_URL&&/^[a-z0-9-]+\.vercel\.app$/.test(process.env.VERCEL_URL))return`https://${process.env.VERCEL_URL}`;return 'https://lumacleanrs.com';}
export async function customerChannelSummary(db:PrismaClient){
 const s=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
 return Promise.all(customerChannels.map(async channel=>{
  const [inbound,outbound]=await Promise.all([db.message.findFirst({where:{conversation:{channel},author:'CLIENT'},orderBy:{receivedAt:'desc'},select:{receivedAt:true}}),db.message.findFirst({where:{conversation:{channel},author:{in:['AI','ADMIN','SYSTEM']},deliveryAttempts:{gt:0}},orderBy:{deliveryUpdatedAt:'desc'},select:{deliveryUpdatedAt:true,deliveryStatus:true,deliveryError:true}})]);
  const diag=(s.customerChannelDiagnostics as Record<string,Probe>)[channel];return{channel,...channelConfiguration(channel),ready:channelReady(s,channel),mode:(s.aiChannelModes as Record<string,string>)[channel]??'OFF',notifications:!!(s.customerNotificationChannels as Record<string,boolean>)[channel],lastWebhook:diag?.lastWebhookAt??inbound?.receivedAt?.toISOString()??null,lastOutbound:outbound?.deliveryUpdatedAt?.toISOString()??null,deliveryStatus:outbound?.deliveryStatus??null,deliveryError:outbound?.deliveryError??null,diagnostic:diag?.code??'NOT_TESTED',webhook:`${channelBaseUrl()}/api/channels/${channel.toLowerCase()}`};
 }));
}
export function assertCustomerChannelReady(settings:Pick<BusinessSettings,'customerChannelDiagnostics'>,channel:CustomerChannel){if(!channelReady(settings,channel))throw new AgentError('CHANNEL_CONNECTION_TEST_REQUIRED');}
export type ChannelSummary=Awaited<ReturnType<typeof customerChannelSummary>>;
export type ChannelDiagnostics=Prisma.InputJsonObject;
