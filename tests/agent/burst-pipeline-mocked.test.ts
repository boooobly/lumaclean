// Runs the real ingress, claim, runner and persistence with a serialized in-memory
// Prisma substitute and controlled providers. This is NOT PostgreSQL or delivery E2E.
import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import type {PrismaClient,Conversation} from '../../src/generated/prisma/client';
import {acceptMessage} from '../../src/lib/agent/inbox';
import {claimJob,runClaimedJob} from '../../src/lib/agent/runner';
import {AgentError} from '../../src/lib/agent/contracts';
import type {AIProvider,AgentMessage,Completion} from '../../src/lib/agent/providers';

// Generic test rows emulate several unrelated Prisma models and query operators.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row=Record<string,any>;
function matches(row:Row,where:Row={}):boolean{
  return Object.entries(where).every(([key,value])=>{
    if(value===undefined)return true;
    if(key==='AND')return value.every((w:Row)=>matches(row,w));
    if(key==='OR')return value.some((w:Row)=>matches(row,w));
    if(key==='conversationId_externalMessageId')return matches(row,value);
    const actual=row[key];
    if(value&&typeof value==='object'&&!(value instanceof Date))return Object.entries(value as Row).every(([op,v])=>{
      if(op==='in')return v.includes(actual);
      if(op==='notIn')return !v.includes(actual);
      if(op==='not')return actual!==v;
      if(op==='gt')return actual>v;
      if(op==='gte')return actual>=v;
      if(op==='lt')return actual<v;
      if(op==='lte')return actual<=v;
      throw Error(`Unimplemented test query: ${op}`);
    });
    return actual instanceof Date&&value instanceof Date?+actual===+value:actual===value;
  });
}
function fixture(locale='ru'){
  const tables:Record<string,Row[]>={};
  const db:Row={};
  const clone=(r:Row|null)=>r?structuredClone(r):null;
  const apply=(row:Row,data:Row)=>{for(const [key,value] of Object.entries(data))row[key]=value&&typeof value==='object'&&'increment' in value?(row[key]??0)+value.increment:value;return clone(row);};
  for(const model of ['message','conversation','businessSettings','agentJob','aIInvocation','chatAttachment','agentToolTrace','lead','leadExtra','service','serviceExtra','auditLog','shadowSuggestion','humanHandoff','notification']){
    const rows:Row[]=tables[model]=[];
    const found=(q:Row={})=>{
      let result=rows.filter(row=>matches(row,q.where));
      if(q.orderBy){const order=Array.isArray(q.orderBy)?q.orderBy:[q.orderBy];result.sort((a,b)=>{for(const clause of order){const [key,direction]=Object.entries(clause)[0];if(a[key]<b[key])return direction==='asc'?-1:1;if(a[key]>b[key])return direction==='asc'?1:-1;}return 0;});}
      if(q.take)result=result.slice(0,q.take);
      return result;
    };
    db[model]={
      findMany:async(q:Row)=>structuredClone(found(q)),
      findFirst:async(q:Row)=>clone(found(q)[0]??null),
      findUnique:async(q:Row)=>clone(found(q)[0]??null),
      findUniqueOrThrow:async(q:Row)=>{const r=found(q)[0];assert.ok(r,`${model} missing`);return clone(r);},
      count:async(q:Row)=>found(q).length,
      create:async({data}:Row)=>{const r={id:randomUUID(),createdAt:new Date(),sentAt:new Date(),readAt:null,deliveryStatus:'DELIVERED',responseToMessageId:null,structured:null,attempts:0,status:'PENDING',leaseKey:null,leaseUntil:null,...data};rows.push(r);return clone(r);},
      update:async({where,data}:Row)=>{const r=found({where})[0];assert.ok(r,`${model} update missing`);return apply(r,data);},
      updateMany:async({where,data}:Row)=>{const selected=found({where});selected.forEach(r=>apply(r,data));return {count:selected.length};},
      deleteMany:async({where}:Row)=>{const selected=found({where});tables[model]=rows.filter(r=>!selected.includes(r));return {count:selected.length};},
      upsert:async({where,create,update}:Row)=>{const existing=found({where})[0];return existing?apply(existing,update):db[model].create({data:create});},
      aggregate:async()=>({_sum:{estimatedCostUsd:0},_count:{estimatedCostUsd:0,_all:0}}),
    };
  }
  let tail=Promise.resolve();
  db.$transaction=(fn:(tx:Row)=>unknown)=>{const operation=tail.then(()=>fn(db));tail=operation.then(()=>{},()=>{});return operation;};
  db.$queryRaw=async()=>[{count:1}];
  db.$queryRawUnsafe=async()=>[];
  tables.businessSettings.push({id:'default',aiAgentMode:'AUTO',aiChannelModes:{WEBSITE:'AUTO'},aiAllowedServices:['regular','deep'],aiMaxAnonymousMessages:80,aiMaxModelCalls:8,aiMaxToolSteps:8,aiMaxConversationCostUsd:5,timezone:'Europe/Belgrade'});
  const c:Row={id:randomUUID(),channel:'WEBSITE',locale,displayAlias:'Anna',control:'AI_CONTROL',revision:0,state:{},summary:null,shadowState:{},leadId:null,stage:'NEW',ownerId:null};
  tables.conversation.push(c);
  tables.service.push({id:'service-deep',code:'deep',active:true});
  const typed=db as PrismaClient;
  const send=(text:string,id=randomUUID(),receivedAt=new Date())=>acceptMessage(typed,c as Conversation,{id,text,transport:{key:`mock:${id}`,receivedAt,metadata:{}}});
  const claim=async()=>{const result=await claimJob(typed,c.id);assert.ok(result);return result;};
  const replies=()=>tables.message.filter(m=>m.author==='AI');
  return {db:typed,tables,c,send,claim,replies};
}
function provider(fn:(messages:AgentMessage[])=>Promise<string>|string):AIProvider{
  return {name:'mock',model:'test',complete:async messages=>({text:await fn(messages),toolCalls:[],inputTokens:1,outputTokens:1,cachedInputTokens:0,latencyMs:1,estimatedCostUsd:0,provider:'mock',model:'test'} as Completion)};
}

test('mocked pipeline regressions: no external systems',async t=>{
  const saved=process.env.AI_AGENT_ENABLED;process.env.AI_AGENT_ENABLED='true';
  try{
    await t.test('three/five accepted messages and same ID retry produce one complete current turn',async()=>{
      for(const count of [3,5]){
        const f=fixture(),id=randomUUID(),at=new Date();
        await Promise.all(Array.from({length:count},(_,i)=>f.send(`Question ${String.fromCharCode(65+i)}?`,i===0?id:randomUUID(),at)));
        assert.equal((await f.send('Question A?',id,at)).created,false);
        assert.equal(f.tables.message.length,count);
        const claim=await f.claim();assert.equal(claim.turn.length,count);
        let calls=0;
        const p=provider(messages=>{calls++;for(let i=0;i<count;i++)assert.ok(messages.some(m=>m.role==='user'&&m.content===`Question ${String.fromCharCode(65+i)}?`));return 'I will check each requested detail.';});
        await runClaimedJob(f.db,claim,[p,p]);
        assert.equal(calls,1);assert.equal(f.replies().length,1);assert.match(f.replies()[0].text,/^Здравствуйте!/);
        assert.equal(f.tables.agentJob.filter(j=>j.status==='SUPERSEDED').length,count-1);
        await runClaimedJob(f.db,claim,[p,p]);assert.equal(f.replies().length,1);
      }
    });
    await t.test('a price question in a burst does not bypass the model and discard separate questions',async()=>{
      const f=fixture();
      const texts=['Нужна генеральная уборка 60 м². Сколько стоит всё вместе?','Вы привозите свои средства?','Как можно оплатить?'];
      for(const text of texts)await f.send(text);
      const p=provider(messages=>{texts.forEach(text=>assert.ok(messages.some(m=>m.role==='user'&&m.content===text)));return 'Уточню каждый из ваших вопросов по условиям уборки.';});
      await runClaimedJob(f.db,await f.claim(),[p,p]);
      assert.equal(f.replies().length,1);assert.match(f.replies()[0].text,/Уточню каждый/);
      assert.equal(f.tables.lead.length,1);assert.equal(f.c.state.draftFacts.area,60);
    });
    await t.test('incoming message during generation supersedes old output; next job sees all questions',async()=>{
      const f=fixture();await f.send('Question A?');await f.send('Question B?');
      const stale=provider(async()=>{await f.send('Question C?');return 'Stale answer.';});
      await runClaimedJob(f.db,await f.claim(),[stale,stale]);
      assert.equal(f.replies().length,0);
      const latest=await f.claim();assert.equal(latest.turn.length,3);
      const p=provider(messages=>{assert.ok(messages.some(m=>m.content==='Question C?'));return 'Current answer.';});
      await runClaimedJob(f.db,latest,[p,p]);assert.equal(f.replies().length,1);assert.ok(!f.replies()[0].text.includes('Stale'));
    });
    await t.test('provider timeout falls back once and continuation does not greet again',async()=>{
      const f=fixture('en');await f.send('Question A?');await f.send('Question B?');
      const primary=provider(()=>{throw new AgentError('PROVIDER_TIMEOUT_OR_NETWORK');});
      const backup=provider(()=>'Hello! Here are the requested details.');
      await runClaimedJob(f.db,await f.claim(),[primary,backup]);
      assert.equal(f.replies().length,1);assert.equal((f.replies()[0].text.match(/Hello!/g)??[]).length,1);
      await f.send('Question C?');await f.send('Question D?');
      await runClaimedJob(f.db,await f.claim(),[primary,backup]);
      assert.equal(f.replies().length,2);assert.equal(f.replies()[1].text,'Here are the requested details.');
    });
    await t.test('all providers unavailable persist safe recovery once',async()=>{
      const f=fixture();await f.send('Question A?');await f.send('Question B?');
      const offline=provider(()=>{throw new AgentError('PROVIDER_TIMEOUT_OR_NETWORK');});
      await runClaimedJob(f.db,await f.claim(),[offline,offline]);
      assert.equal(f.replies().length,1);assert.equal(f.tables.agentJob.at(-1)?.status,'DONE');
      assert.equal(f.tables.lead.length,0);
    });
    await t.test('human takeover and OFF mode prevent a claim; prior operator reply prevents a new greeting',async()=>{
      const f=fixture('en');await f.send('Question A?');f.c.control='HUMAN_CONTROL';
      assert.equal(await claimJob(f.db,f.c.id),null);
      f.c.control='AI_CONTROL';f.tables.message.push({id:randomUUID(),conversationId:f.c.id,author:'ADMIN',deliveryStatus:'DELIVERED',sentAt:new Date(Date.now()+10),text:'Operator answered.'});
      await f.send('Question B?');await f.send('Question C?');
      const p=provider(()=>'Hello! Continuing with your questions.');
      await runClaimedJob(f.db,await f.claim(),[p,p]);assert.equal(f.replies()[0].text,'Continuing with your questions.');
      f.tables.businessSettings[0].aiAgentMode='OFF';await f.send('Question D?');assert.equal(await claimJob(f.db,f.c.id),null);
    });
    await t.test('SHADOW creates a suggestion without publishing an answer',async()=>{
      const f=fixture();f.tables.businessSettings[0].aiAgentMode='SHADOW';
      await f.send('Question A?');await f.send('Question B?');
      const p=provider(()=>'Proposed answer.');await runClaimedJob(f.db,await f.claim(),[p,p]);
      assert.equal(f.replies().length,0);assert.equal(f.tables.shadowSuggestion.length,1);
    });
    await t.test('an expired worker lease is recovered without a duplicate answer',async()=>{
      const f=fixture();await f.send('Question A?');await f.send('Question B?');
      const old=await f.claim();f.tables.agentJob.at(-1)!.leaseUntil=new Date(0);
      const retry=await f.claim();assert.notEqual(retry.leaseKey,old.leaseKey);
      const p=provider(()=>'Recovered answer.');
      await runClaimedJob(f.db,old,[p,p]);assert.equal(f.replies().length,0);
      await runClaimedJob(f.db,retry,[p,p]);assert.equal(f.replies().length,1);
    });
  }finally{if(saved===undefined)delete process.env.AI_AGENT_ENABLED;else process.env.AI_AGENT_ENABLED=saved;}
});
