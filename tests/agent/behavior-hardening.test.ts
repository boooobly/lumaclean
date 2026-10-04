import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {buildAgentTemporalContext,resolveCustomerDate,serviceDatePolicy,departurePolicy,latestStartForEndBy,incomingDeparturePolicy} from '../../src/lib/agent/temporal';
import {masculineSelfReference,repairPreservesFacts,transparencyAnswer} from '../../src/lib/agent/persona';
import {createReplySet,activeReplySet,replyFacts,inputAlreadyKnown} from '../../src/lib/agent/chat-presentation';
import {applyCustomerFacts,explicitCustomerFacts,supportedFacts} from '../../src/lib/agent/customer-facts';
import {mandatoryHandoff,conversationPolicy,outputAllowed} from '../../src/lib/agent/policy';
import {toolSchemas,type AgentState} from '../../src/lib/agent/contracts';
import {findSlots} from '../../src/lib/services/routing-planning';
import type {Prisma} from '../../src/generated/prisma/client';
import {qualificationProvider} from '../../src/lib/agent/live-test';
import {completeWithFallback} from '../../src/lib/agent/runner';
import type {AIProvider,Completion} from '../../src/lib/agent/providers';
const settings={timezone:'Europe/Belgrade',sameDayBookingCutoffMinute:1020,latestCleanerDepartureMinute:1020};
const at=(time:string)=>new Date(`2026-10-04T${time}+02:00`);
test('native Preview qualification rejects wrong tools or changed facts and really uses fallback',async()=>{
 const input={service:'deep' as const,area:50,soilLevel:'NORMAL' as const,extras:[],urgent:false};
 const answer=(tool:string,facts:unknown):Completion=>({text:'',toolCalls:[{id:'synthetic',name:tool as 'calculatePrice',arguments:JSON.stringify(facts)}],provider:'synthetic',model:'synthetic',inputTokens:1,cachedInputTokens:0,outputTokens:1,latencyMs:1,estimatedCostUsd:0});
 const provider=(tool:string,facts:unknown):AIProvider=>({name:tool,model:'synthetic',complete:async()=>answer(tool,facts)});
 const attempts:(string|null)[]=[];
 const result=await completeWithFallback([qualificationProvider(provider('recordCustomerFacts',input),input),qualificationProvider(provider('calculatePrice',input),input)],[],async(_,r,code)=>{attempts.push(r?'OK':code);});
 assert.deepEqual(attempts,['NATIVE_QUALIFICATION_INVALID','OK']);assert.equal(result.toolCalls[0].name,'calculatePrice');
 await assert.rejects(qualificationProvider(provider('calculatePrice',{...input,area:80}),input).complete([]),/NATIVE_QUALIFICATION_FACTS_MISMATCH/);
});
for(const [time,allowed] of [['16:59:59',true],['17:00:00',false],['20:00:00',false]] as const) test(`Belgrade same-day at ${time}`,()=>{
  const context=buildAgentTemporalContext(at('16:59:00'),settings,at(time));assert.equal(context.sameDayBookingAllowedNow,allowed);
  const policy=serviceDatePolicy('2026-10-04',settings,at(time));assert.equal('error' in policy,!allowed);if(!allowed)assert.equal(policy.earliestDate,'2026-10-05');
});
test('midnight and delayed jobs use distinct interpretation and feasibility clocks',()=>{
  const sent=at('23:59:00'),now=new Date('2026-10-05T00:01:00+02:00');
  assert.equal(resolveCustomerDate('завтра',sent,settings.timezone),'2026-10-05');
  assert.equal(buildAgentTemporalContext(sent,settings,now).messageLocalDate,'2026-10-04');
  assert.equal(buildAgentTemporalContext(sent,settings,now).nowLocalDate,'2026-10-05');
  const today=resolveCustomerDate('сегодня',at('16:59:00'),settings.timezone)!;
  assert.equal(serviceDatePolicy(today,settings,at('17:01:00')).error,'SAME_DAY_CUTOFF');
  assert.equal(serviceDatePolicy('2026-10-04',settings,at('17:05:00')).error,'SAME_DAY_CUTOFF');
  assert.equal(serviceDatePolicy('2026-10-03',settings,at('10:00:00')).error,'PAST_SERVICE_DATE');
});
test('cutoff short-circuits before calendar, crew, route or address search',async()=>{
  const db=new Proxy({businessSettings:{findUniqueOrThrow:async()=>settings}},{get(target,key){if(key==='businessSettings')return target.businessSettings;throw Error('UNEXPECTED_SEARCH');}}) as unknown as Prisma.TransactionClient;
  const result=await findSlots(db,{date:'2026-10-04',from:'2026-10-04T17:30',to:'2026-10-04T22:00',duration:150,requiredCleaners:2},{now:at('17:00:00')});
  assert('error' in result);assert.equal(result.error,'SAME_DAY_CUTOFF');assert.deepEqual(result.slots,[]);
});
test('DST changes use IANA rules, not a fixed UTC offset',()=>{
  for(const [instant,time] of [['2026-10-25T00:30:00Z','02:30'],['2026-10-25T01:30:00Z','02:30'],['2026-03-29T00:30:00Z','01:30'],['2026-03-29T01:30:00Z','03:30']])assert(buildAgentTemporalContext(new Date(instant),settings,new Date(instant)).nowLocalTime.startsWith(time));
});
test('each cleaner departure must be before 17:00 and not in the past',()=>{
  const date='2026-10-04',now=at('16:00:00');
  assert(departurePolicy(at('16:59:59').toISOString(),date,settings,now).allowed);
  assert.equal(departurePolicy(at('17:00:00').toISOString(),date,settings,now).error,'LATEST_DEPARTURE_EXCEEDED');
  assert.equal(departurePolicy(at('15:59:59').toISOString(),date,settings,now).error,'PAST_DEPARTURE');
  const crew=['16:40:00','17:05:00'].map(time=>departurePolicy(at(time).toISOString(),date,settings,now));assert(!crew.every(result=>result.allowed));
  assert.equal(departurePolicy(at('16:40:00').toISOString(),date,settings,now,{status:'SCHEDULED',end:at('14:00:00').toISOString()}).error,'CURRENT_CREW_POSITION_UNVERIFIED');
});
test('completed previous job uses actual now and cannot miss the next start',()=>{
 const leg={departure:at('14:00:00').toISOString(),start:at('17:00:00').toISOString(),travelSeconds:4800,bufferMinutes:30,previous:{status:'COMPLETED',end:at('14:00:00').toISOString()}};
 const feasible=incomingDeparturePolicy(leg,'2026-10-04',settings,at('15:00:00'));assert('allowed' in feasible&&feasible.allowed);
 assert.equal(incomingDeparturePolicy(leg,'2026-10-04',settings,at('16:00:00')).error,'PAST_DEPARTURE');
});
test('finish-by math stays in the server, distinct from arrival/start intent',()=>{
  assert.equal(latestStartForEndBy('2026-10-05T16:00',150,settings.timezone),'2026-10-05T13:30');
  assert.equal(latestStartForEndBy('2026-10-05T16:00',480,settings.timezone),'2026-10-05T08:00');
  assert.equal(resolveCustomerDate('в два',at('12:00:00'),settings.timezone),undefined);
});
test('persona output guard detects self-reference, preserving other people and quotes',()=>{
  for(const word of ['понял','передал','проверил','уточнил','нашёл','записал','сохранил','готов','рад'])assert(masculineSelfReference(`Я ${word}.`,'ru'),word);
  for(const text of ['Поняла, спасибо.','Передаю вопрос команде.','Клиент сказал: «Я понял».','Он проверил адрес.','Администратор нашёл адрес.','Вы спросили «готов ли оператор».'])assert(!masculineSelfReference(text,'ru'),text);
  assert(masculineSelfReference('Proverio sam adresu.','sr-Latn'));assert(!masculineSelfReference('Proverila sam adresu.','sr-Latn'));
  assert(masculineSelfReference('Проверио сам адресу.','sr-Cyrl'));assert(!masculineSelfReference('Проверила сам адресу.','sr-Cyrl'));
  assert(!masculineSelfReference('I checked the address.','en'));
  assert(repairPreservesFacts('Я проверил: 8300 RSD, 12:30, ORD-AI-ABC.','Я проверила: 8300 RSD, 12:30, ORD-AI-ABC.'));
  assert(!repairPreservesFacts('8300 RSD, 12:30','8400 RSD, 12:30'));
  assert(!repairPreservesFacts('Я понял: тяжёлую мебель не перемещаем.','Я поняла: тяжёлую мебель перемещаем.'));
});
test('reply sets survive reload/SSE snapshots but cannot survive consumption, revision or handoff',()=>{
  const now=at('10:00:00'),set=createReplySet({nextInput:'SOIL_LEVEL'},'ru',4,'AI_CONTROL',now)!;
  for(let read=0;read<3;read++)assert.equal(activeReplySet({replySet:JSON.parse(JSON.stringify(set))},4,'AI_CONTROL',now)?.id,set.id);
  assert.equal(activeReplySet({replySet:{...set,consumedAt:now.toISOString()}},4,'AI_CONTROL',now),null);
  assert.equal(activeReplySet({replySet:set},5,'AI_CONTROL',now),null);
  assert.equal(activeReplySet({replySet:set},4,'HUMAN_CONTROL',now),null);
  assert.equal(activeReplySet({replySet:set},4,'AI_CONTROL',new Date(now.getTime()+600001)),null);
  assert.equal(createReplySet({nextInput:'SOIL_LEVEL',draftFacts:{soilLevel:'NORMAL'}},'ru',4,'AI_CONTROL',now),null);
  const state:AgentState={nextInput:'AREA',draftFacts:{soilLevel:'NORMAL',service:'regular'}};assert.equal(createReplySet(state,'ru',4,'AI_CONTROL',now),null);
});
function preparedState():AgentState {
  return {draftFacts:{service:'regular',area:60,soilLevel:'NORMAL',extras:[],extrasConfirmed:true,requestedDate:'2026-10-04'},quote:{id:'quote',serviceId:'service',input:{service:'regular',area:60,soilLevel:'NORMAL',extras:[],urgent:true},total:9000,base:7500,discountPercent:0,requiresHumanReview:false,at:at('10:00:00').toISOString()},duration:{minutes:150,reserve:30,requiredCleaners:2,ruleId:'rule',version:1},address:{fullAddress:'Address A',proof:'synthetic'},slots:[{token:randomUUID(),start:at('15:00:00').toISOString(),duration:150}],pending:{nonce:randomUUID(),slotToken:randomUUID(),reschedule:false,recap:{service:'regular',area:60,extras:[],address:'Address A',start:at('15:00:00').toISOString(),durationMinutes:150,price:9000,currency:'RSD'}}};
}
for(const [label,change,retainQuote] of [['60 to 80',{area:80},false],['regular to deep',{service:'deep'},false],['no extras to oven',{extras:[{code:'oven',quantity:1}],extrasConfirmed:true},false],['today to tomorrow',{requestedDate:'2026-10-05'},false],['address A to B',{addressQuery:'Address B'},true]] as const)test(`correction invalidation: ${label}`,()=>{
  const state=preparedState();applyCustomerFacts(state,JSON.parse(JSON.stringify(change)));assert(!state.slots);assert(!state.pending);assert.equal(!!state.quote,retainQuote);assert.equal(state.draftFacts?.soilLevel,'NORMAL');if(label==='address A to B')assert(!state.address);
});
test('server quick choices save facts before a model job and no guess is accepted as evidence',()=>{
  const state:AgentState={};applyCustomerFacts(state,replyFacts('SOIL_NORMAL'));assert.equal(state.draftFacts?.soilLevel,'NORMAL');assert(inputAlreadyKnown('SOIL_LEVEL',state));
  const facts=explicitCustomerFacts('У меня 60 квадратов, поддерживающая нужна',at('14:18:00'),settings.timezone);assert.equal(facts.area,60);assert.equal(facts.service,'regular');assert(!facts.soilLevel);
  assert(!supportedFacts({area:80},facts));assert(!toolSchemas.recordCustomerFacts.safeParse({facts:{clientId:'foreign'},evidence:'authorized'}).success);
});
test('urgent is authoritative by service date; output guard rejects invented facts',()=>{
  assert.equal(serviceDatePolicy('2026-10-04',settings,at('10:00:00')).urgent,true);assert.equal(serviceDatePolicy('2026-10-05',settings,at('10:00:00')).urgent,false);
  assert(!outputAllowed('Цена 99999 RSD',{}));assert(!outputAllowed('Booking confirmed',{}));assert(!outputAllowed('Available tomorrow at 12:00',{}));assert(!outputAllowed('API_KEY=secret',{}));
});
test('policy uses persona, temporal context and existing routing without legacy Google dependency',()=>{
  const policy=conversationPolicy('ru',{},null,buildAgentTemporalContext(at('10:00:00'),settings,at('20:00:00')),'Mila');
  assert(policy.includes('female'));assert(policy.includes('Mila'));assert(policy.includes('messageLocalDate'));assert(policy.includes('requestCustomerInput'));assert(!policy.includes('Google reliability'));
  assert(transparencyAnswer('Вы человек?','ru','Mila')?.includes('AI-администратор'));
  assert.equal(mandatoryHandoff('А у вас мужчины или женщины?'),null);
});
