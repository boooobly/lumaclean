import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {pgConnectionString} from '../../src/lib/database/connection';
import {acceptMessage,publicConversation} from '../../src/lib/agent/inbox';
import {drainAgentJobs,claimJob} from '../../src/lib/agent/runner';
import {executeAgentTool,json,stateOf,type ToolContext} from '../../src/lib/agent/tools';
import type {AIProvider} from '../../src/lib/agent/providers';
import type {AgentState} from '../../src/lib/agent/contracts';
const url=process.env.CONVERSION_TEST_DATABASE_URL;
test('real incident: native Preview persistence, soft review, contact and hard safety',{skip:!url},async t=>{
  assert(new URL(url!).hostname.startsWith('ep-wispy-river-b8xwqy9q'));
  process.env.AI_AGENT_ENABLED='true';
  const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url!),max:5})});
  const baseline=await db.businessSettings.findUniqueOrThrow({where:{id:'default'}});
  const owned:string[]=[];
  const provider:AIProvider={name:'synthetic',model:'test',complete:async()=>assert.fail('Incident qualification must not need inference or arithmetic')};
  async function fixture(state:AgentState={}){
    const c=await db.conversation.create({data:{channel:'WEBSITE',locale:'sr-Latn',externalThreadId:'conversion-test:'+randomUUID(),state:json(state)}});
    owned.push(c.id);return c;
  }
  async function send(id:string,text:string){
    // Scoped synthetic rate window only; production throttles are unchanged.
    await db.rateLimit.deleteMany({where:{key:{startsWith:'agent:message:'+id+':'}}});
    const c=await db.conversation.findUniqueOrThrow({where:{id}});
    await acceptMessage(db,c,{id:randomUUID(),text});
    await drainAgentJobs(db,id,[provider,provider]);
    const live=await db.conversation.findUniqueOrThrow({where:{id}});
    const last=await db.message.findFirstOrThrow({where:{conversationId:id,author:'AI'},orderBy:{sentAt:'desc'}});
    assert.equal(live.control,'AI_CONTROL');assert.equal(live.orderId,null);return{live,last,state:stateOf(live)};
  }
  try{
    await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:'AUTO',aiChannelModes:{...baseline.aiChannelModes as object,WEBSITE:'AUTO'}}});
    await t.test('full incident survives rejected appliances, ambiguity, windows and SMS',async()=>{
      const c=await fixture();
      const first=await send(c.id,'Dobar dan, treba mi generalno čišćenje stana od 57 kvadrata, ukoliko je moguce ovog vikenda, pranje prozora, roletni, jedno kupatilo, tepisi ce biti na pranju. Pozdrav mogućnosti da budu dve osobe da bi kraće trajalo. Da li je to moguce kod vas i koja bi bila cena');
      assert(first.live.leadId);assert(first.state.review?.reasons.includes('CUSTOM_EXTRA'));assert.equal(first.state.draftFacts?.service,'deep');assert(first.last.text.includes('rerne'));
      await send(c.id,'Lokacija je bgd, banovo brdo');
      await send(c.id,'Nisu, samo spolja');
      const soil=await send(c.id,'Uobičajena zaprljanost');assert(soil.last.text.includes('prozora'));
      const ambiguous=await send(c.id,'Vrv redovno, ne znam sta vam je dubinsko tačno, al ne treba čišćenje kreveta i tepiha');
      assert.equal(ambiguous.state.draftFacts?.service,'deep');assert(ambiguous.last.text.includes('lajsna')||ambiguous.last.text.includes('lajsnama'));
      const buttons=await publicConversation(db,c);assert.equal(buttons.quickReplies?.choices.length,2);
      await send(c.id,'Generalno');
      await send(c.id,'Nije selidba i nije krečenje, uobičajeno jesenje');
      await send(c.id,'Bez dodatnih usluga');
      const windows=await send(c.id,'5 velikih i dva mala');
      assert.equal(windows.state.quote?.total,18500);assert.equal(windows.state.draftFacts?.windowCleaning?.largeCount,5);assert.equal(windows.state.draftFacts?.windowCleaning?.standardCount,2);
      assert(windows.last.text.includes('18.500'));assert(windows.last.text.includes('6.000'));assert(windows.last.text.includes('1.800'));assert(windows.last.text.includes('Roletne'));assert(windows.last.text.includes('subota ili nedelja'));assert(windows.live.needsAttention);assert(windows.state.draftFacts?.requestedWeekend);assert.equal(windows.state.draftFacts?.neighborhoodHint,'Banovo brdo');
      const sms=await send(c.id,'Da li možete da mi odgovorite sms porukom');assert(sms.last.text.includes('broj telefona'));assert.equal(sms.state.preferredContactChannel,'SMS');
      const offered=await send(c.id,'Da vam pošaljem broj tel');assert(offered.last.text.includes('broj telefona'));
      const contact=await send(c.id,'060 123-4567');assert.equal(contact.state.phone,'+381601234567');assert.equal(contact.live.identityVerified,false);
      const lead=await db.lead.findUniqueOrThrow({where:{id:contact.live.leadId!}});assert.equal(lead.normalizedPhone,'+381601234567');
      assert(await db.notification.count({where:{conversationId:c.id,kind:'HANDOFF',text:{contains:'SMS'}}}));
      const source=await db.message.create({data:{conversationId:c.id,author:'CLIENT',text:'Synthetic booking guard'}});
      const leaseKey=randomUUID(),job=await db.agentJob.create({data:{conversationId:c.id,messageId:source.id,status:'RUNNING',leaseKey,leaseUntil:new Date(Date.now()+180000)}});
      const ctx:ToolContext={conversationId:c.id,jobId:job.id,leaseKey,revision:contact.live.revision,mode:'AUTO',state:contact.state};
      const result=await executeAgentTool(db,ctx,'createOrder',{});assert.equal(result.error,'REVIEW_REQUIRED');
      assert.equal(await db.humanHandoff.count({where:{conversationId:c.id,reason:{not:{startsWith:'SOFT:'}}}}),0);
      assert.equal(await db.agentToolTrace.count({where:{conversationId:c.id,tool:'requestHumanHandoff'}}),0);
    });
    await t.test('uncertainty evidence cannot be clipped into a correction; known extras cannot be asked again',async()=>{
      const c=await fixture({draftFacts:{service:'deep',extras:[],extrasConfirmed:true}});
      await acceptMessage(db,c,{id:randomUUID(),text:'Vrv redovno, ne znam sta vam je dubinsko tacno'});
      const claim=await claimJob(db,c.id);assert(claim);
      const ctx:ToolContext={conversationId:c.id,jobId:claim.job.id,leaseKey:claim.leaseKey,revision:claim.conversation.revision,mode:'AUTO',state:stateOf(claim.conversation)};
      const correction=await executeAgentTool(db,ctx,'recordCustomerFacts',{facts:{service:'regular'},evidence:'redovno'});assert.equal(correction.error,'CUSTOMER_FACTS_REQUIRED');
      const repeated=await executeAgentTool(db,ctx,'requestCustomerInput',{intent:'EXTRAS'});assert.equal(repeated.error,'FACT_ALREADY_KNOWN');assert.equal(ctx.responseText,undefined);assert.equal(ctx.state.draftFacts?.service,'deep');
    });
    await t.test('hard safety stops conversation; subsequent sales tools remain forbidden',async()=>{
      const c=await fixture();await acceptMessage(db,c,{id:randomUUID(),text:'There are needles and blood'});
      await drainAgentJobs(db,c.id,[provider,provider]);const live=await db.conversation.findUniqueOrThrow({where:{id:c.id}});assert.equal(live.control,'HUMAN_CONTROL');assert.equal(live.orderId,null);
      assert.equal(await db.humanHandoff.count({where:{conversationId:c.id,reason:'HAZARDOUS_CLEANING'}}),1);
      await acceptMessage(db,live,{id:randomUUID(),text:'I can send my number'});assert.equal(await claimJob(db,c.id),null);
    });
  }finally{
    await db.businessSettings.update({where:{id:'default'},data:{aiAgentMode:baseline.aiAgentMode,aiChannelModes:baseline.aiChannelModes!}});
    for(const id of owned){
      const c=await db.conversation.findUniqueOrThrow({where:{id}});assert.equal(c.orderId,null);
      await db.notification.deleteMany({where:{conversationId:id}});await db.shadowSuggestion.deleteMany({where:{conversationId:id}});await db.agentSlot.deleteMany({where:{conversationId:id}});await db.agentToolTrace.deleteMany({where:{conversationId:id}});await db.aIInvocation.deleteMany({where:{conversationId:id}});await db.humanHandoff.deleteMany({where:{conversationId:id}});await db.agentJob.deleteMany({where:{conversationId:id}});await db.message.deleteMany({where:{conversationId:id}});await db.conversation.update({where:{id},data:{leadId:null}});if(c.leadId)await db.lead.delete({where:{id:c.leadId}});await db.conversation.delete({where:{id}});
    }
    await db.$disconnect();
  }
});
