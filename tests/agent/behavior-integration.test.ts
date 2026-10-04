import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {pgConnectionString} from '../../src/lib/database/connection';
import {acceptMessage,publicConversation,runInboxCommand} from '../../src/lib/agent/inbox';
import {drainAgentJobs} from '../../src/lib/agent/runner';
import {createReplySet} from '../../src/lib/agent/chat-presentation';
import {uploadAttachment,type ChatAttachmentStorage} from '../../src/lib/agent/chat-attachments';
import {slotFingerprint,executeAgentTool,json,type ToolContext} from '../../src/lib/agent/tools';
import type {AgentState} from '../../src/lib/agent/contracts';
import type {AIProvider,Completion} from '../../src/lib/agent/providers';
const url=process.env.BEHAVIOR_TEST_DATABASE_URL;
test('behavior uses durable conversation state and native jobs in isolated Preview', {skip:!url}, async t=>{
  assert(new URL(url!).hostname.startsWith('ep-wispy-river-b8xwqy9q'));
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:5})});
  const namespace='behavior-test:'+randomUUID(),owned:string[]=[];
  const baseline=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  const owner=await db.user.findFirstOrThrow({where:{role:'ADMIN',active:true}});
  const completion=(text:string,tool?:string,args:unknown={}):Completion=>({text,toolCalls:tool?[{id:randomUUID(),name:tool as 'requestCustomerInput',arguments:JSON.stringify(args)}]:[],provider:'synthetic',model:'gpt-6-luna',inputTokens:1,cachedInputTokens:0,outputTokens:1,latencyMs:1,estimatedCostUsd:0.000001});
  const question:AIProvider={name:'synthetic',model:'gpt-6-luna',complete:async()=>completion('','requestCustomerInput',{intent:'SOIL_LEVEL'})};
  async function fixture(state:AgentState={}){
    const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'ru',externalThreadId:namespace+':'+owned.length,state:json(state),displayAlias:'Mila'}});owned.push(c.id);return c;
  }
  async function soilQuestion(){const c=await fixture();await acceptMessage(db,c,{id:randomUUID(),text:'Здравствуйте'});await drainAgentJobs(db,c.id,[question,question]);const snapshot=await publicConversation(db,c);assert(snapshot.quickReplies);return{c,snapshot};}
  try{
    await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'AUTO',aiChannelModes:{WEBSITE:'AUTO',TELEGRAM:'OFF',WHATSAPP:'OFF',VIBER:'OFF'}}});
    await t.test('button double tap and old-tab race produce exactly one CLIENT and consume stored set',async()=>{
      const {c,snapshot}=await soilQuestion(),set=snapshot.quickReplies!;
      const q={key:'SOIL_NORMAL',messageId:set.messageId,replySetId:set.replySetId,revision:set.revision},id=randomUUID();
      const results=await Promise.all([acceptMessage(db,c,{id,text:'',quickReply:q}),acceptMessage(db,c,{id,text:'',quickReply:q})]);assert.equal(results[0].messageId,results[1].messageId);
      assert.equal(await db.message.count({where:{conversationId:c.id,externalMessageId:`in:${id}`}}),1);
      await assert.rejects(acceptMessage(db,c,{id:randomUUID(),text:'',quickReply:q}),/STALE_QUICK_REPLY/);
      const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert.equal((current.state as AgentState).draftFacts?.soilLevel,'NORMAL');
      const source=await db.message.findUniqueOrThrow({where:{id:set.messageId}});assert((source.structured as {replySet:{consumedAt:string}}).replySet.consumedAt);
      assert.equal((await publicConversation(db,c)).quickReplies,null);
    });
    await t.test('manual text consumes choices; reload and SSE projection cannot resurrect them',async()=>{
      const {c,snapshot}=await soilQuestion();await acceptMessage(db,c,{id:randomUUID(),text:'Обычные'});
      for(let i=0;i<3;i++)assert.equal((await publicConversation(db,c)).quickReplies,null);
      assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).revision,snapshot.revision+1);
      assert.equal(((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).state as AgentState).draftFacts?.soilLevel,'NORMAL');
    });
    await t.test('photo-only inbound consumes the current reply set without inferring dirt or area',async()=>{
      const {c}=await soilQuestion();
      const storage:ChatAttachmentStorage={write:async()=>{},read:async()=>Buffer.alloc(0),remove:async()=>{}};
      const photo=await sharp({create:{width:8,height:8,channels:3,background:'white'}}).jpeg().toBuffer();
      const attachment=await uploadAttachment(db,c.id,randomUUID(),photo,'image/jpeg','CLIENT',storage);
      await acceptMessage(db,c,{id:randomUUID(),text:'',attachmentIds:[attachment.id]});assert.equal((await publicConversation(db,c)).quickReplies,null);
      assert.equal(((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).state as AgentState).draftFacts,undefined);
    });
    await t.test('new assistant turn supersedes previous buttons and handoff removes all active choices',async()=>{
      const {c}=await soilQuestion();const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});
      const state:AgentState={nextInput:'EXTRAS'};const set=createReplySet(state,'ru',current.revision,'AI_CONTROL')!;
      await db.message.create({data:{conversationId:c.id,author:'AI',text:'Дополнительные услуги?',structured:{replySet:set},sentAt:new Date(Date.now()+1000)}});
      assert.equal((await publicConversation(db,c)).quickReplies?.replySetId,set.id);
      await runInboxCommand(db,owner.id,{action:'takeover',id:c.id});assert.equal((await publicConversation(db,c)).quickReplies,null);
    });
    await t.test('persona repair is one bounded native pass; repeated source still gets one reply',async()=>{
      const c=await fixture();const id=randomUUID();await acceptMessage(db,c,{id,text:'Здравствуйте'});let calls=0;
      const provider:AIProvider={name:'synthetic',model:'gpt-6-luna',complete:async()=>completion(++calls===1?'Я понял.':'Я поняла.')};
      await drainAgentJobs(db,c.id,[provider,provider]);await drainAgentJobs(db,c.id,[provider,provider]);
      assert.equal(calls,2);const replies=await db.message.findMany({where:{conversationId:c.id,author:'AI'}});assert.equal(replies.length,1);assert.equal(replies[0].text,'Я поняла.');
    });
    await t.test('failed persona repair cannot alter facts or execute returned tools',async()=>{
      const c=await fixture();await acceptMessage(db,c,{id:randomUUID(),text:'Здравствуйте'});let calls=0;
      const provider:AIProvider={name:'synthetic',model:'gpt-6-luna',complete:async()=>++calls===1?completion('Я понял.'):completion('Я поняла.','createOrder')};
      await drainAgentJobs(db,c.id,[provider,provider]);assert.equal(calls,2);assert.equal(await db.agentToolTrace.count({where:{conversationId:c.id,tool:'createOrder'}}),0);assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).orderId,null);
    });
    await t.test('60 to 80 correction clears quote, duration, slots and confirmation before the model',async()=>{
      const c=await fixture({draftFacts:{area:60,service:'regular',soilLevel:'NORMAL',extras:[],extrasConfirmed:true},quote:{id:'q',serviceId:'s',input:{area:60,service:'regular',soilLevel:'NORMAL',extras:[],urgent:false},total:7600,base:7600,discountPercent:0,requiresHumanReview:false,at:new Date().toISOString()},duration:{minutes:150,reserve:30,requiredCleaners:2,ruleId:'r',version:1},slots:[]});
      await acceptMessage(db,c,{id:randomUUID(),text:'Нет, площадь 80 м²'});const state=(await db.conversation.findUniqueOrThrow({where:{id:c.id}})).state as AgentState;assert.equal(state.draftFacts?.area,80);assert(!state.quote);assert(!state.duration);assert(!state.slots);assert(!state.pending);
    });
    await t.test('strong dirt button hands off normally and generates Telegram outbox without booking',async()=>{
      const {c,snapshot}=await soilQuestion(),set=snapshot.quickReplies!;
      await acceptMessage(db,c,{id:randomUUID(),text:'',quickReply:{key:'SOIL_HEAVY',messageId:set.messageId,replySetId:set.replySetId,revision:set.revision}});
      await drainAgentJobs(db,c.id,[question,question]);assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).control,'HUMAN_CONTROL');assert.equal(await db.humanHandoff.count({where:{conversationId:c.id,reason:'PRICE_REVIEW'}}),1);assert.equal(await db.notification.count({where:{conversationId:c.id,kind:'HANDOFF_TELEGRAM'}}),1);assert.equal((await publicConversation(db,c)).quickReplies,null);
    });
    await t.test('direct human/bot question is transparent without a model call or lead',async()=>{
      const c=await fixture();await acceptMessage(db,c,{id:randomUUID(),text:'Вы человек?'});
      const provider:AIProvider={name:'synthetic',model:'gpt-6-luna',complete:async()=>assert.fail('no model required')};await drainAgentJobs(db,c.id,[provider,provider]);
      const last=await db.message.findFirstOrThrow({where:{conversationId:c.id,author:'AI'}});assert(last.text.includes('Mila, AI-администратор'));assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).leadId,null);
    });
    await t.test('same-day message processed after cutoff never searches, invokes the model or hands off',async()=>{
      const c=await fixture();const message=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text:'Можно сегодня?',sentAt:at('16:59')}});await db.agentJob.create({data:{conversationId:c.id,messageId:message.id}});
      const provider:AIProvider={name:'synthetic',model:'gpt-6-luna',complete:async()=>assert.fail('cutoff is deterministic')};
      const RealDate=Date,fixed=at('17:01').getTime();globalThis.Date=class extends RealDate{constructor(value?:string|number|Date){super(value??fixed);}static now(){return fixed;}} as typeof Date;
      try{await drainAgentJobs(db,c.id,[provider,provider]);const last=await db.message.findFirstOrThrow({where:{conversationId:c.id,author:'AI'}});assert(last.text.includes('начиная с завтра'));assert.equal(await db.agentToolTrace.count({where:{conversationId:c.id,tool:'findAvailableSlots'}}),0);const current=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert.equal(current.control,'AI_CONTROL');assert.equal(current.orderId,null);assert.equal(current.leadId,null);}finally{globalThis.Date=RealDate;}
    });
    await t.test('16:30 token cannot validate at 17:05 even while unexpired and fingerprint matches',async()=>{
      const state:AgentState={name:'Synthetic',phone:'+381601234567',requestedWindow:{date:'2026-10-04',from:'2026-10-04T16:00',to:'2026-10-04T22:00'},quote:{id:'q',serviceId:'s',input:{area:60,service:'regular',soilLevel:'NORMAL',extras:[],urgent:true},total:9000,base:7500,discountPercent:0,requiresHumanReview:false,at:at('16:30').toISOString()},duration:{minutes:150,reserve:30,requiredCleaners:2,ruleId:'r',version:1},address:{fullAddress:'Synthetic'}};
      const c=await fixture(state),token=randomUUID(),leaseKey=randomUUID();const message=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text:'Synthetic token selection'}});
      const job=await db.agentJob.create({data:{conversationId:c.id,messageId:message.id,status:'RUNNING',leaseKey,leaseUntil:at('19:00')}});
      await db.agentSlot.create({data:{id:token,conversationId:c.id,start:at('18:00'),durationMinutes:150,requiredCleaners:2,cleanerIds:[],fingerprint:slotFingerprint(state),scheduleVersion:'synthetic',routingSnapshot:{},expiresAt:at('19:00')}});
      const ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:0,mode:'AUTO',state};
      const RealDate=Date,fixed=at('17:05').getTime();globalThis.Date=class extends RealDate{constructor(value?:string|number|Date){super(value??fixed);}static now(){return fixed;}} as typeof Date;
      try{const result=await executeAgentTool(db,ctx,'validateSlot',{slotToken:token});assert.equal(result.error,'SAME_DAY_CUTOFF');assert.equal((await db.conversation.findUniqueOrThrow({where:{id:c.id}})).orderId,null);}finally{globalThis.Date=RealDate;}
    });
  }finally{
    await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:baseline.aiAgentMode,aiChannelModes:baseline.aiChannelModes!}});
    for(const id of owned){
      await db.notification.deleteMany({where:{conversationId:id}});await db.chatAttachment.deleteMany({where:{conversationId:id}});await db.shadowSuggestion.deleteMany({where:{conversationId:id}});await db.agentSlot.deleteMany({where:{conversationId:id}});await db.agentToolTrace.deleteMany({where:{conversationId:id}});await db.aIInvocation.deleteMany({where:{conversationId:id}});await db.humanHandoff.deleteMany({where:{conversationId:id}});await db.agentJob.deleteMany({where:{conversationId:id}});await db.message.deleteMany({where:{conversationId:id}});const c=await db.conversation.findUnique({where:{id}});if(c?.orderId)assert.fail('Unexpected synthetic order');await db.conversation.update({where:{id},data:{leadId:null}});if(c?.leadId)await db.lead.delete({where:{id:c.leadId}});await db.conversation.delete({where:{id}});
    }
    await db.$disconnect();
  }
});
function at(time:string){return new Date(`2026-10-04T${time}:00+02:00`);}
