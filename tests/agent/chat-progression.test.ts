import assert from 'node:assert/strict';
import test from 'node:test';
import type {AgentState,ToolName,ToolResult} from '../../src/lib/agent/contracts';
import {explicitCustomerFacts,applyCustomerFacts} from '../../src/lib/agent/customer-facts';
import {conversionIntake,nextQualification} from '../../src/lib/agent/conversion-intake';
import {outputAllowed,mandatoryHandoff} from '../../src/lib/agent/policy';
import {safeRecovery} from '../../src/lib/agent/autonomy';
import {partialCleaningScope} from '../../src/lib/agent/conversion-facts';
import {upholsteryBookingIntent} from '../../src/lib/upholstery-intent';

function ready():AgentState{return {draftFacts:{service:'regular',area:50,soilLevel:'NORMAL',extras:[],extrasConfirmed:true,requestedDate:'2026-10-23'},quote:{id:'q',serviceId:'s',input:{service:'regular',area:50,soilLevel:'NORMAL',extras:[],urgent:false},total:6000,base:6000,discountPercent:0,requiresHumanReview:false,at:new Date().toISOString()},duration:{ruleId:'r',version:1,minutes:150,reserve:30,requiredCleaners:2},address:{fullAddress:'Synthetic test address',proof:'synthetic'}};}
test('short refusals complete extras without erasing already selected items',()=>{
 for(const text of ['Не','нет','Не надо','Не нужно','No','No thanks','None','Ne','Ne treba','Не треба','Не.']){
  const state:AgentState={draftFacts:{service:'regular',area:50,soilLevel:'NORMAL',extras:[{code:'oven',quantity:1}]},nextInput:'EXTRAS'};
  applyCustomerFacts(state,explicitCustomerFacts(text,new Date(),'Europe/Belgrade','EXTRAS',state));
  assert.equal(state.draftFacts?.extrasConfirmed,true,text);assert.deepEqual(state.draftFacts?.extras,[{code:'oven',quantity:1}]);assert.equal(nextQualification(state),undefined);
 }
});
test('a bare no outside the extras question does not invent an extras answer',()=>{
 assert.equal(explicitCustomerFacts('Нет',new Date(),'Europe/Belgrade','AREA',{}).extrasConfirmed,undefined);
});
test('explicit window refusal after a FAQ is not a window selection',()=>{
 for(const text of ['Ne želim da dodam prozore','Не желим прање прозора','Окна мыть не нужно','Не хочу добавлять окна',"I don't want windows"]){
  const facts=explicitCustomerFacts(text,new Date(),'Europe/Belgrade',undefined,{});assert.equal(facts.windowCleaning?.requested,false,text);
 }
});
test('acknowledgements and attention checks are not customer names',()=>{
 for(const text of ['Ага','Угу','Хорошо','Окей','Алло','Okay','OK','Hello','U redu','Važi','Da'])assert.equal(explicitCustomerFacts(text,new Date(),'Europe/Belgrade','NAME',{}).name,undefined,text);
 for(const text of ['Наташа','Али','Ana','Alex Smith'])assert.equal(explicitCustomerFacts(text,new Date(),'Europe/Belgrade','NAME',{}).name,text);
});
test('upholstery capability questions do not create a booking intake',()=>{
 for(const text of ['Can you clean a sofa?','Could you clean a carpet?','Вы можете почистить диван?','Možete li oprati kauč?'])assert.equal(upholsteryBookingIntent(text),false,text);
 for(const text of ['I want sofa cleaning','Can you clean my sofa?','Хочу заказать химчистку дивана'])assert(upholsteryBookingIntent(text),text);
});
test('Serbian nothing else is not the city Niš',()=>{
 for(const text of ['Ništa više','Ništa dodatno','Nisam siguran','Ништа више'])assert.equal(mandatoryHandoff(text),null,text);
 for(const text of ['Treba mi čišćenje u Niš','Adresa: Niš.','Nis','Novi Sad','Pančevu'])assert.equal(mandatoryHandoff(text),'OUTSIDE_SERVICE_AREA',text);
});
test('room-only and unscoped balcony requests require scope review',()=>{
 for(const text of ['убрать кухню\nи балкон\nу меня 50 квадратов','Уберите только кухню','I need only kitchen cleaning','Želim samo balkon'])assert(partialCleaningScope(text),text);
 for(const text of ['Нужна обычная уборка квартиры 50 м²','Что входит в уборку кухни?','Балкон не нужен','I need cleaning without balcony'])assert.equal(partialCleaningScope(text),false,text);
 assert.equal(partialCleaningScope('Нужна уборка квартиры 50 м², уберите кухню'),false);
 assert.equal(partialCleaningScope('Уберите кухню',{draftFacts:{service:'regular',area:50}}),false);
});
test('date acknowledgement must not falsely claim a booking',()=>{
 for(const text of ['Записала на 22 октября.','Записала вас на завтра.','I booked you for tomorrow.','You are booked.','Zakazala sam za sutra.','Заказала сам за сутра.'])assert.equal(outputAllowed(text,{}),false,text);
 assert(outputAllowed('Сохранила желаемую дату. Запись ещё не подтверждена.',{}));
 for(const text of ['No booking is confirmed yet.','The team checks the material before booking is confirmed.','Rezervacija još nije potvrđena.','Резервација још није потврђена.'])assert(outputAllowed(text,{}),text);
 assert.equal(outputAllowed('No booking is confirmed yet. You are booked.',{}),false);
});
test('a precise start time checks the actual slot tool before offering selection',async()=>{
 const state=ready(),calls:{name:ToolName;args:unknown}[]=[];
 const tool=async(name:ToolName,args:unknown):Promise<ToolResult>=>{calls.push({name,args});if(name==='findAvailableSlots'){state.slots=[{token:'scoped',start:'2026-10-23T10:00:00.000Z',duration:150}];return{slots:[{slotToken:'scoped',start:'2026-10-23T12:00'}]};}if(name==='requestCustomerInput')return{question:'Какое время вам подходит?'};throw Error('Unexpected tool '+name);};
 const reply=await conversionIntake(()=>state,'12:00','ru',tool,undefined,'На какое время завтра вам удобно начать уборку?');
 assert.deepEqual(calls.map(c=>c.name),['findAvailableSlots','requestCustomerInput']);
 assert.deepEqual(calls[0].args,{date:'2026-10-23',from:'2026-10-23T12:00',to:'2026-10-23T15:00',timeIntent:'START_AT'});
 assert.match(reply!,/12:00/);assert.equal(state.booking,undefined);assert.equal(state.pending,undefined);
});
test('no availability asks for another window without repeating the quote',async()=>{
 const state=ready();const reply=await conversionIntake(()=>state,'Начать в 12:00','ru',async name=>{assert.equal(name,'findAvailableSlots');return{error:'NO_SLOTS'};});
 assert.match(reply!,/другой день/);assert.doesNotMatch(reply!,/6.?000/);assert.equal(state.booking,undefined);
});
test('an arrival or finish-time question cannot silently become a start-time search',async()=>{
 for(const prompt of ['What time should we finish?','Do you mean arrival time or cleaning start time?','К какому времени закончить уборку?']){
  const result=await conversionIntake(()=>ready(),'12:00','en',async()=>assert.fail('Time intent needs clarification'),undefined,prompt);assert.equal(result,undefined);
 }
});
test('fallback advances to missing scheduling or contact data instead of a quote loop',()=>{
 const state=ready();const text=safeRecovery(state,'ru');assert.match(text,/точное время/);assert.doesNotMatch(text,/6.?000/);
 state.slots=[{token:'scoped',start:'2026-10-23T10:00:00.000Z',duration:150}];
 assert.match(safeRecovery(state,'ru'),/Как вас зовут/);assert.equal(state.nextInput,'NAME');state.name='Synthetic';
 assert.match(safeRecovery(state,'ru'),/номер телефона/);assert.equal(state.nextInput,'PHONE');
});
