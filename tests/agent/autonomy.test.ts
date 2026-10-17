import assert from 'node:assert/strict';
import test from 'node:test';
import {autonomyCorpus} from './fixtures/autonomy-corpus';
import {mandatoryHandoff,outputAllowed} from '../../src/lib/agent/policy';
import {reasonLevel,errorDisposition} from '../../src/lib/agent/autonomy';
import {explicitCustomerFacts} from '../../src/lib/agent/customer-facts';
import {applyCustomerFacts,supportedFacts} from '../../src/lib/agent/customer-facts';
import type {AgentState} from '../../src/lib/agent/contracts';
import {conversionFacts} from '../../src/lib/agent/conversion-facts';
import {upholsteryBookingIntent} from '../../src/lib/upholstery-intent';
import {autonomyMetrics} from '../../src/lib/agent/autonomy-metrics';
import {routineFaq} from '../../src/lib/agent/routine-faq';
export function corpusLevel(text:string,event?:string){
 if(event==='HUMAN_CONTROL')return 'HARD_HANDOFF';
 if(['NO_SLOTS','AMBIGUOUS','PHOTO','INVALID_TOOL_ARGUMENTS'].includes(event??''))return 'CLARIFICATION';
 const reason=mandatoryHandoff(text);
 if(reason)return reasonLevel(reason);
 if(upholsteryBookingIntent(text)||conversionFacts(text,new Date(),'Europe/Belgrade').reviewItems?.length)return 'SOFT_REVIEW';
 return 'AI_HANDLES';
}
for(const s of autonomyCorpus)test('autonomy corpus '+s.id,()=>{
 assert.equal(corpusLevel(s.text,s.event),s.expected);
 if(s.facts){const facts=explicitCustomerFacts(s.text,new Date('2026-10-13T10:00:00Z'),'Europe/Belgrade');for(const [key,value] of Object.entries(s.facts))assert.equal(facts[key as keyof typeof facts],value);}
});
test('unknown mutation, identity and quota errors remain hard; correction and missing data do not',()=>{
 for(const code of ['TOOL_EXECUTION_UNCERTAIN','IDENTITY_REQUIRED','MODEL_CALL_LIMIT','CONVERSATION_COST_LIMIT','CONTEXT_LIMIT','DAILY_BUDGET_LIMIT'])assert.equal(errorDisposition(code),'HARD');
 for(const code of ['INVALID_TOOL_ARGUMENTS','CONTACT_REQUIRED','NO_SLOTS','AMBIGUOUS','STALE_SLOT','UPHOLSTERY_MANAGER_INTAKE'])assert.equal(errorDisposition(code),'CLARIFY');
});
test('unsupported price, slot and booking claims stay blocked',()=>{
 for(const text of ['Цена 999999 RSD.','Вы записаны.','Available tomorrow at 10:00.','Можете оставить ключи под ковриком.','You can pay by card.','We will reimburse you.','Передала запрос команде.'])assert(!outputAllowed(text,{}));
 assert(!outputAllowed('Сумма известных позиций: 999999 RSD.',{quote:{id:'q',serviceId:'s',input:{service:'regular',area:80,soilLevel:'NORMAL',extras:[],urgent:false},total:10000,base:10000,discountPercent:0,requiresHumanReview:false,at:new Date().toISOString()}}));
});
test('FAQ is not upholstery booking intent; district hints are unverified facts',()=>{
 for(const text of ['Вы делаете химчистку диванов?','Химчисткой занимаетесь?','Do you offer upholstery cleaning?','Da li radite dubinsko pranje nameštaja?','Да ли радите дубинско прање намештаја?'])assert(!upholsteryBookingIntent(text));
 assert.equal(explicitCustomerFacts('Район: Zemun',new Date(),'Europe/Belgrade').neighborhoodHint,'Zemun');
 assert(!outputAllowed('Всем постоянным клиентам скидка 10%.',{}));
});
test('FAQ mentions do not reset confirmed service, extras or existing quote',()=>{
 const state:AgentState={draftFacts:{service:'regular',area:80,soilLevel:'NORMAL',extras:[],extrasConfirmed:true},quote:{id:'q',serviceId:'s',input:{service:'regular',area:80,soilLevel:'NORMAL',extras:[],urgent:false},total:10000,base:10000,discountPercent:0,requiresHumanReview:false,at:new Date().toISOString()}};
 for(const text of ['What does deep cleaning include?','Что входит в генеральную уборку?','Вы моете окна?','Сколько стоит холодильник внутри?'])applyCustomerFacts(state,explicitCustomerFacts(text,new Date(),'Europe/Belgrade',undefined,state));
 for(const s of autonomyCorpus.filter(s=>s.category==='appliance'))applyCustomerFacts(state,explicitCustomerFacts(s.text,new Date(),'Europe/Belgrade',undefined,state));
 assert.equal(state.draftFacts?.service,'regular');assert(!state.draftFacts?.serviceConfirmationRequired);assert.equal(state.quote?.id,'q');assert.deepEqual(state.draftFacts?.extras,[]);
});
test('greeting and abandonment are not successful consultations; soft review is not full automation',()=>{
 const now=new Date(),row={id:'c',state:{},orderId:null,lastMessageAt:now,messages:[{author:'CLIENT',text:'Hello',sentAt:now,structured:null,deliveryStatus:'DELIVERED'}],handoffs:[],toolTraces:[],invocations:[]};
 assert.equal(autonomyMetrics([row],new Set(),new Map()).substantive,0);
 const substantive={...row,state:{draftFacts:{area:80}},messages:[{...row.messages[0],text:'80 m²'}]};
 const unknown=autonomyMetrics([substantive],new Set(),new Map());assert.equal(unknown.unknown,1);assert.equal(unknown.aiOnlyConsultation,0);
 const failedFaq={...row,messages:[{...row.messages[0],text:'What cleaning products do you use?'}]};assert.equal(autonomyMetrics([failedFaq],new Set(),new Map()).substantive,1);
 const review={...substantive,handoffs:[{id:'h',reason:'SOFT:PRICE_REVIEW'}]};assert.equal(autonomyMetrics([review],new Set(),new Map()).fullAutomation,0);
});
test('only assessed hard handoffs enter false-positive denominator, using latest assessment',()=>{
 const row={id:'c',state:{},orderId:null,lastMessageAt:new Date(),messages:[],handoffs:[{id:'h',reason:'UNCERTAINTY'},{id:'s',reason:'SOFT:PRICE_REVIEW'}],toolTraces:[],invocations:[]};
 const m=autonomyMetrics([row],new Set(),new Map([['h',true],['s',true]]));assert.equal(m.audited,1);assert.equal(m.falsePositiveRate,100);
});
test('legacy FAQ cannot override versioned business facts with canned payment/key/discount replies',async()=>{
 for(const s of autonomyCorpus.filter(s=>['payment-faq','discount-faq','access-faq'].includes(s.category))){
  const calls:string[]=[];
  const answer=await routineFaq(s.text,s.locale,async name=>{calls.push(name);throw Error('Business FAQ must use knowledge retrieval');});
  assert.equal(answer,undefined,s.id);assert.deepEqual(calls,[]);
 }
 assert.equal(await routineFaq('Дайте индивидуальную скидку.', 'ru',async()=>{throw Error('must not use FAQ shortcut')}),undefined);
 assert.equal(await routineFaq('Можно картой? Нужна уборка квартиры 80 м².', 'ru',async()=>{throw Error('must not skip intake')}),undefined);
});
test('direct model questions cannot repeat known qualification; recaps and alternatives remain possible',()=>{
 const state:AgentState={draftFacts:{service:'deep',area:80,soilLevel:'NORMAL',bathroomCount:2,requestedDate:'2026-10-20'}};
 for(const text of ['Какая площадь квартиры?','How big is the apartment?','Kolika je površina stana?','Колика је површина стана?','Сколько санузлов?','На какую дату нужна уборка?'])assert(!outputAllowed(text,state),text);
 for(const text of ['Какой другой день проверить?','Подтвердите, пожалуйста, ранее согласованные условия?','Какие дополнительные услуги нужны?'])assert(outputAllowed(text,state),text);
 assert(outputAllowed('Какая площадь квартиры?',{}));
});
test('operator source supports exact correction values independent of JSON property order',()=>{
 const source=explicitCustomerFacts('Хорошо, окна тогда тоже добавим. Их 3 больших.',new Date(),'Europe/Belgrade');
 assert(supportedFacts({windowCleaning:{largeCount:3,requested:true}},source));
 assert(!supportedFacts({windowCleaning:{requested:true,largeCount:30}},source));
 assert(!supportedFacts({area:1},explicitCustomerFacts('Исправлю: площадь 65 м²',new Date(),'Europe/Belgrade')));
});
