import {after,NextResponse} from 'next/server';
import {ZodError} from 'zod';
import {getDatabase} from '@/lib/database/client';
import {boundedBody} from '@/lib/services/admin-http';
import {CrmError} from '@/lib/domain/crm';
import {AgentError} from './contracts';
import {channelConfiguration,normalizeTelegram,normalizeWhatsApp,normalizeViber,parseProviderJson,verifySignature,verifyWebhookSecret,type CustomerChannel} from './channels';
import {acceptChannelMessage,rateLimit} from './inbox';
import {applyChannelStatus} from './channel-ingress';
import {enqueueAgent} from './queue';
import {drainAgentJobs} from './runner';
export async function customerWebhook(request:Request,channel:CustomerChannel){
 if(!channelConfiguration(channel).configured)return NextResponse.json({ok:false,disabled:true},{status:503});
 try{
  if(channel==='TELEGRAM'&&!verifyWebhookSecret(request.headers.get('x-telegram-bot-api-secret-token')))return NextResponse.json({ok:false},{status:403});
  const body=await boundedBody(request,channel==='WHATSAPP'?3*1024*1024:128000);
  if(channel!=='TELEGRAM'&&!verifySignature(channel,body,request.headers.get(channel==='WHATSAPP'?'x-hub-signature-256':'x-viber-content-signature')))return NextResponse.json({ok:false},{status:403});
  const db=getDatabase();await rateLimit(db,`webhook:${channel}`,600);
  const raw=channel==='VIBER'?parseProviderJson(body.toString()):JSON.parse(body.toString());
  const telegram=channel==='TELEGRAM'?normalizeTelegram(raw):null;
  const events=channel==='WHATSAPP'?normalizeWhatsApp(raw):channel==='VIBER'?normalizeViber(raw):{messages:telegram?[telegram]:[],statuses:[]};
  if(events.messages.length+events.statuses.length>1000)throw new AgentError('WEBHOOK_BATCH_LIMIT');
  for(const status of events.statuses)await applyChannelStatus(db,status);
  for(const event of events.messages){
   const accepted=await acceptChannelMessage(db,event);
   const job=await db.agentJob.findUniqueOrThrow({where:{messageId:accepted.messageId}});
   // Retry publication even for duplicate ingress, closing the commit/publish crash window.
   if(!await enqueueAgent(db,job.conversationId))after(()=>drainAgentJobs(db,job.conversationId));
  }
  await db.$executeRaw`UPDATE "BusinessSettings" SET "customerChannelDiagnostics" = jsonb_set("customerChannelDiagnostics", ARRAY[${channel}], COALESCE("customerChannelDiagnostics" -> ${channel}, '{}'::jsonb) || jsonb_build_object('lastWebhookAt', ${new Date().toISOString()}::text), true) WHERE id='default'`;
  return NextResponse.json({ok:true});
 }catch(e){const code=e instanceof AgentError?e.code:e instanceof CrmError?e.code:'';return NextResponse.json({ok:false},{status:code==='TOO_LARGE'?413:code==='RATE_LIMIT'?429:e instanceof SyntaxError||e instanceof ZodError||['INVALID_TELEGRAM_UPDATE','PRIVATE_CHAT_REQUIRED','INBOUND_IDENTITY_CONFLICT','INVALID_CHANNEL_IDENTITY'].includes(code)?400:503});}
}
