import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import test from 'node:test';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {customerWebhook} from '../../src/lib/agent/channel-webhook';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
import {acceptMessage} from '../../src/lib/agent/inbox';
import {websiteLeadSchema} from '../../src/lib/validation/crm';
import {saveWebsiteLead,notifyWebsiteLead} from '../../src/lib/services/website-leads';
import {deliverNotification} from '../../src/lib/agent/notifications';
import {sendAdminLeadTelegram} from '../../src/lib/agent/telegram-handoff';
import {leadRequestSource} from '../../src/lib/services/lead-rate-limit';
import type {AIProvider} from '../../src/lib/agent/providers';
import {runCrmCommand} from '../../src/lib/services/crm-commands';

const url=process.env.RELIABILITY_TEST_DATABASE_URL,base=process.env.RELIABILITY_TEST_BASE_URL;
const payload=()=>({submissionId:randomUUID(),name:'Synthetic reliability',phone:'0641234567',locale:'ru' as const,service:'regular' as const,area:55,extras:[],urgent:false,consent:true as const});
test('reliability: isolated PostgreSQL intake and delivery regressions',{skip:!url||!base},async t=>{
  const target=new URL(url!),origin=new URL(base!);
  assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/lumaclean_reliability_test');assert.equal(origin.hostname,'127.0.0.1');
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:url!,max:3})});
  const env={...process.env},threadBase=Date.now();
  (globalThis as {lumaDatabase?:PrismaClient}).lumaDatabase=db;
  process.env.TELEGRAM_CUSTOMER_BOT_TOKEN='synthetic-customer';process.env.TELEGRAM_CUSTOMER_WEBHOOK_SECRET='synthetic-secret';
  process.env.WHATSAPP_VERIFY_TOKEN='synthetic-verify';process.env.WHATSAPP_GRAPH_VERSION='v23.0';process.env.WHATSAPP_ACCESS_TOKEN='synthetic-wa';process.env.WHATSAPP_APP_SECRET='synthetic-app';process.env.WHATSAPP_PHONE_NUMBER_ID='22222';process.env.WHATSAPP_BUSINESS_ACCOUNT_ID='11111';
  process.env.VIBER_CUSTOMER_BOT_TOKEN='synthetic-viber';
  delete process.env.VERCEL;delete process.env.TELEGRAM_BOT_TOKEN;delete process.env.TELEGRAM_CHAT_ID;delete process.env.AI_AGENT_ENABLED;
  const admin=await db.user.create({data:{id:randomUUID(),name:'Reliability operator',email:`${randomUUID()}@example.test`,role:'ADMIN'}});
  const post=(input:unknown)=>fetch(`${base}/api/lead`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});
  try{
    await t.test('HUMAN_CONTROL webhooks acknowledge and deduplicate across all three channels without AI work',async()=>{
      for(const channel of ['TELEGRAM','WHATSAPP','VIBER'] as const){
        const thread=channel==='TELEGRAM'?String(threadBase):channel==='WHATSAPP'?String(threadBase+2):`synthetic-${threadBase}=`;
        const c=await db.conversation.create({data:{channel,externalThreadId:thread,control:'HUMAN_CONTROL',ownerId:admin.id}});
        const raw=channel==='TELEGRAM'?{update_id:1,message:{message_id:1,chat:{id:Number(thread),type:'private'},from:{id:Number(thread),is_bot:false},text:'Сообщение оператору'}}:channel==='WHATSAPP'?{object:'whatsapp_business_account',entry:[{id:'11111',changes:[{field:'messages',value:{metadata:{phone_number_id:'22222'},messages:[{id:`synthetic-wa-${threadBase}`,from:thread,timestamp:String(Math.floor(Date.now()/1000)),type:'text',text:{body:'Сообщение оператору'}}]}}]}]}:{event:'message',timestamp:Date.now(),message_token:String(threadBase+4),sender:{id:thread},message:{type:'text',text:'Сообщение оператору'}};
        const body=JSON.stringify(raw),headers:Record<string,string>={'Content-Type':'application/json'};
        if(channel==='TELEGRAM')headers['x-telegram-bot-api-secret-token']='synthetic-secret';
        else headers[channel==='WHATSAPP'?'x-hub-signature-256':'x-viber-content-signature']=(channel==='WHATSAPP'?'sha256=':'')+createHmac('sha256',channel==='WHATSAPP'?'synthetic-app':'synthetic-viber').update(body).digest('hex');
        for(let i=0;i<2;i++)assert.equal((await customerWebhook(new Request('https://test.invalid/webhook',{method:'POST',headers,body}),channel,async()=>assert.fail('No AI job for operator'))).status,200,channel);
        assert.equal(await db.message.count({where:{conversationId:c.id,author:'CLIENT'}}),1);
        assert.equal(await db.agentJob.count({where:{conversationId:c.id}}),0);
        const saved=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert.equal(saved.unreadCount,1);assert(saved.needsAttention);assert.equal(saved.ownerId,admin.id);
      }
    });
    await t.test('queue publication failure leaves one recoverable AI job and acknowledges duplicate webhook',async()=>{
      const thread=String(threadBase+1),body=JSON.stringify({update_id:2,message:{message_id:2,chat:{id:Number(thread),type:'private'},from:{id:Number(thread),is_bot:false},text:'Нужна уборка'}});
      let wakes=0;
      for(let i=0;i<2;i++)assert.equal((await customerWebhook(new Request('https://test.invalid/webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'synthetic-secret'},body}),'TELEGRAM',async()=>{wakes++;throw Error('queue unavailable');},()=>{/* Keep pending work for the recovery assertion. */})).status,200);
      const c=await db.conversation.findUniqueOrThrow({where:{channel_externalThreadId:{channel:'TELEGRAM',externalThreadId:thread}}});
      assert.equal(await db.message.count({where:{conversationId:c.id}}),1);assert.equal(await db.agentJob.count({where:{conversationId:c.id,status:'PENDING'}}),1);assert.equal(wakes,2);
      // OFF drains without invoking a provider; the queue row survives until recovery claims it.
      assert.equal(await claimJob(db,c.id),null);assert.equal(await db.agentJob.count({where:{conversationId:c.id,status:'DONE'}}),1);
    });
    await t.test('SHADOW generates a suggestion without sending a reply to the customer',async()=>{
      const settings=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
      process.env.AI_AGENT_ENABLED='true';
      try{
        await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'SHADOW',aiChannelModes:{WEBSITE:'SHADOW'}}});
        const c=await db.conversation.create({data:{channel:'WEBSITE'}});
        await acceptMessage(db,c,{id:randomUUID(),text:'Здравствуйте'});
        const claim=await claimJob(db,c.id);assert(claim);assert.equal(claim.mode,'SHADOW');
        const provider:AIProvider={name:'synthetic',model:'synthetic',complete:async()=>({text:'Подскажите тип уборки?',toolCalls:[],provider:'synthetic',model:'synthetic',inputTokens:1,cachedInputTokens:0,outputTokens:1,latencyMs:1,estimatedCostUsd:0})};
        await runClaimedJob(db,claim,[provider,provider],async()=>({images:[],count:0}),()=>({send:async()=>assert.fail('SHADOW must not send')}));
        assert.equal(await db.shadowSuggestion.count({where:{conversationId:c.id}}),1);
        assert.equal(await db.message.count({where:{conversationId:c.id,author:'AI'}}),0);
      }finally{delete process.env.AI_AGENT_ENABLED;await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:settings.aiAgentMode,aiChannelModes:settings.aiChannelModes!}});}
    });
    await t.test('CLOSED rejects new input using the existing policy, while replay of saved input stays idempotent',async()=>{
      const c=await db.conversation.create({data:{channel:'WEBSITE'}}),id=randomUUID();
      const accepted=await acceptMessage(db,c,{id,text:'Synthetic'});
      await db.conversation.update({where:{id:c.id},data:{control:'CLOSED'}});
      assert.equal((await acceptMessage(db,c,{id,text:'Synthetic'})).messageId,accepted.messageId);
      await assert.rejects(acceptMessage(db,c,{id:randomUUID(),text:'New'}),/CONVERSATION_CLOSED/);
    });
    await t.test('all three public lead kinds atomically create one outbox event, including without an active admin',async()=>{
      for(const kind of ['CLEANING','CLEANING_UPHOLSTERY','UPHOLSTERY']){
        const input=kind==='UPHOLSTERY'?{submissionId:randomUUID(),name:'Synthetic',phone:'0641234567',locale:'ru',consent:true,requestKind:kind}:{...payload(),requestKind:kind};
        const [a,b]=await Promise.all([saveWebsiteLead(db,input),saveWebsiteLead(db,input)]);assert.equal(a.id,b.id);
        assert.equal(await db.notification.count({where:{eventKey:`website-lead:${a.id}:telegram`}}),1);
        const n=await db.notification.findUniqueOrThrow({where:{eventKey:`website-lead:${a.id}:telegram`}});assert.equal(n.deliveryState,'PENDING');
        if(kind==='CLEANING')assert(!n.text.includes('Химчистка:'));
      }
      await db.user.updateMany({where:{role:'ADMIN'},data:{active:false}});
      const lead=await saveWebsiteLead(db,payload());assert(await db.notification.count({where:{eventKey:`website-lead:${lead.id}:telegram`}}));
      await db.user.update({where:{id:admin.id},data:{active:true}});
    });
    await t.test('unconfigured Telegram preserves lead and retry state; recovery may send only once',async()=>{
      const input=payload(),lead=await saveWebsiteLead(db,input),eventKey=`website-lead:${lead.id}:telegram`;
      await notifyWebsiteLead(db,lead,websiteLeadSchema.parse(input),async()=>assert.fail('HTTP intake must not send Telegram'));
      const n=await db.notification.findUniqueOrThrow({where:{eventKey}});
      await assert.rejects(deliverNotification(db,n.id),/NOTIFICATION_RETRY/);
      const pending=await db.notification.findUniqueOrThrow({where:{id:n.id}});assert.equal(pending.deliveryState,'PENDING');assert.equal(pending.lastErrorCode,'INTERNAL_TELEGRAM_UNCONFIGURED');assert(pending.nextAttemptAt);
      assert.equal((await db.lead.findUniqueOrThrow({where:{id:lead.id}})).telegramStatus,'PENDING');
      await db.notification.update({where:{id:n.id},data:{nextAttemptAt:new Date(0)}});
      let sends=0;await deliverNotification(db,n.id,async()=>{sends++;return{status:'DELIVERED',externalMessageId:'synthetic-receipt'};});
      await deliverNotification(db,n.id,async()=>assert.fail('No duplicate confirmed delivery'));
      assert.equal(sends,1);assert.equal((await db.lead.findUniqueOrThrow({where:{id:lead.id}})).telegramStatus,'SENT');
      await assert.rejects(runCrmCommand(db,admin.id,'lead-notification-retry',{id:lead.id}),/Повтор разрешён/);
    });
    await t.test('429 retries; UNKNOWN and expired send leases cannot be retried by worker or CRM',async()=>{
      const lead=await saveWebsiteLead(db,payload()),n=await db.notification.findUniqueOrThrow({where:{eventKey:`website-lead:${lead.id}:telegram`}});
      await assert.rejects(deliverNotification(db,n.id,async()=>({status:'FAILED',errorCode:'TELEGRAM_RATE_LIMIT'})),/NOTIFICATION_RETRY/);
      await db.notification.update({where:{id:n.id},data:{nextAttemptAt:new Date(0)}});
      await deliverNotification(db,n.id,async()=>({status:'UNKNOWN',errorCode:'DELIVERY_OUTCOME_UNKNOWN'}));
      await deliverNotification(db,n.id,async()=>assert.fail('No repeat after ambiguous send'));
      await assert.rejects(runCrmCommand(db,admin.id,'lead-notification-retry',{id:lead.id}),/Повтор разрешён/);
      const other=await saveWebsiteLead(db,payload()),sending=await db.notification.findUniqueOrThrow({where:{eventKey:`website-lead:${other.id}:telegram`}});
      await db.notification.update({where:{id:sending.id},data:{deliveryState:'SENDING',leaseKey:randomUUID(),leaseUntil:new Date(0)}});
      await deliverNotification(db,sending.id,async()=>assert.fail('No retry after worker crash'));
      assert.equal((await db.notification.findUniqueOrThrow({where:{id:sending.id}})).deliveryState,'UNKNOWN');
    });
    await t.test('CRM recovers definite failures under authorization and rejects concurrent duplicate retry',async()=>{
      const lead=await saveWebsiteLead(db,payload()),n=await db.notification.findUniqueOrThrow({where:{eventKey:`website-lead:${lead.id}:telegram`}});
      await db.notification.update({where:{id:n.id},data:{attempts:4}});
      await deliverNotification(db,n.id,async()=>({status:'FAILED',errorCode:'TELEGRAM_RATE_LIMIT'}));
      const results=await Promise.allSettled([runCrmCommand(db,admin.id,'lead-notification-retry',{id:lead.id}),runCrmCommand(db,admin.id,'lead-notification-retry',{id:lead.id})]);
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await db.notification.findUniqueOrThrow({where:{id:n.id}})).deliveryState,'PENDING');
    });
    await t.test('IP headers are ignored on untrusted hosts; Vercel IPv6 privacy addresses share a bucket',()=>{
      const req=(ip:string)=>new Request('http://test.invalid',{headers:{'x-forwarded-for':ip}});
      assert.equal(leadRequestSource(req('1.1.1.1')),leadRequestSource(req('2.2.2.2')));
      process.env.VERCEL='1';process.env.BETTER_AUTH_SECRET='synthetic-source-secret';
      assert.notEqual(leadRequestSource(req('1.1.1.1')),leadRequestSource(req('2.2.2.2')));
      assert.equal(leadRequestSource(req('2001:db8:1:2::1')),leadRequestSource(req('2001:0db8:0001:0002::abcd')));
      delete process.env.VERCEL;
    });
    await t.test('HTTP ordinary client succeeds; same submission remains retryable after parallel new submissions hit 429',async()=>{
      await db.rateLimit.deleteMany({where:{key:{startsWith:'website-lead:'}}});
      const input=payload(),first=await post(input);assert.equal(first.status,200);const accepted=await first.json();
      const responses=await Promise.all(Array.from({length:24},()=>post(payload())));
      assert.equal(responses.filter(r=>r.status===200).length,19);assert.equal(responses.filter(r=>r.status===429).length,5);
      const limited=responses.find(r=>r.status===429)!;assert(Number(limited.headers.get('retry-after'))>0);assert.equal((await limited.json()).error,'RATE_LIMIT');
      const repeat=await post(input);assert.equal(repeat.status,200);assert.equal((await repeat.json()).reference,accepted.reference);
      assert.equal(await db.lead.count({where:{submissionId:input.submissionId}}),1);
      assert.equal((await post({...input,name:'Different payload'})).status,409);
      assert.equal(await db.notification.count({where:{eventKey:`website-lead:${(await db.lead.findUniqueOrThrow({where:{submissionId:input.submissionId}})).id}:telegram`}}),1);
    });
  }finally{
    await db.$disconnect();delete (globalThis as {lumaDatabase?:PrismaClient}).lumaDatabase;
    for(const key of Object.keys(process.env))if(!(key in env))delete process.env[key];Object.assign(process.env,env);
  }
});

test('Telegram API: ambiguous responses are terminal, definite rejection can recover without a real send',async()=>{
  const token=process.env.TELEGRAM_BOT_TOKEN,chat=process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN='synthetic-only';process.env.TELEGRAM_CHAT_ID='synthetic-only';
  try{
    for(const response of [new Response('broken'),Response.json({ok:true}),new Response('down',{status:503})])assert.equal((await sendAdminLeadTelegram('synthetic','fixture',async()=>response)).status,'UNKNOWN');
    assert.equal((await sendAdminLeadTelegram('synthetic','fixture',async()=>{throw Error('timeout');})).status,'UNKNOWN');
    assert.equal((await sendAdminLeadTelegram('synthetic','fixture',async()=>new Response('',{status:429}))).errorCode,'TELEGRAM_RATE_LIMIT');
    assert.equal((await sendAdminLeadTelegram('synthetic','fixture',async()=>Response.json({ok:false},{status:403}))).status,'FAILED');
  }finally{if(token===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=token;if(chat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=chat;}
});
