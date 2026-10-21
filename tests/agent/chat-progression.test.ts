import assert from 'node:assert/strict';
import test from 'node:test';
import type {AgentState,ToolName,ToolResult} from '../../src/lib/agent/contracts';
import {explicitCustomerFacts,applyCustomerFacts} from '../../src/lib/agent/customer-facts';
import {conversionIntake,nextQualification} from '../../src/lib/agent/conversion-intake';
import {outputAllowed} from '../../src/lib/agent/policy';
import {safeRecovery} from '../../src/lib/agent/autonomy';

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
test('date acknowledgement must not falsely claim a booking',()=>{
 for(const text of ['Записала на 22 октября.','Записала вас на завтра.','I booked you for tomorrow.','You are booked.','Zakazala sam za sutra.','Заказала сам за сутра.'])assert.equal(outputAllowed(text,{}),false,text);
 assert(outputAllowed('Сохранила желаемую дату. Запись ещё не подтверждена.',{}));
});
test('a precise start time checks the actual slot tool before offering selection',async()=>{
 const state=ready(),calls:{name:ToolName;args:unknown}[]=[];
 const tool=async(name:ToolName,args:unknown):Promise<ToolResult>=>{calls.push({name,args});if(name==='findAvailableSlots'){state.slots=[{token:'scoped',start:'2026-10-23T10:00:00.000Z',duration:150}];return{slots:[{slotToken:'scoped',start:'2026-10-23T12:00'}]};}if(name==='requestCustomerInput')return{question:'Какое время вам подходит?'};throw Error('Unexpected tool '+name);};
 const reply=await conversionIntake(()=>state,'12:00','ru',tool);
 assert.deepEqual(calls.map(c=>c.name),['findAvailableSlots','requestCustomerInput']);
 assert.deepEqual(calls[0].args,{date:'2026-10-23',from:'2026-10-23T12:00',to:'2026-10-23T15:00',timeIntent:'START_AT'});
 assert.match(reply!,/12:00/);assert.equal(state.booking,undefined);assert.equal(state.pending,undefined);
});
test('no availability asks for another window without repeating the quote',async()=>{
 const state=ready();const reply=await conversionIntake(()=>state,'в 12:00','ru',async name=>{assert.equal(name,'findAvailableSlots');return{error:'NO_SLOTS'};});
 assert.match(reply!,/другой день/);assert.doesNotMatch(reply!,/6.?000/);assert.equal(state.booking,undefined);
});
test('fallback advances to missing scheduling or contact data instead of a quote loop',()=>{
 const state=ready();const text=safeRecovery(state,'ru');assert.match(text,/точное время/);assert.doesNotMatch(text,/6.?000/);
 state.slots=[{token:'scoped',start:'2026-10-23T10:00:00.000Z',duration:150}];
 assert.match(safeRecovery(state,'ru'),/Как вас зовут/);assert.equal(state.nextInput,'NAME');state.name='Synthetic';
 assert.match(safeRecovery(state,'ru'),/номер телефона/);assert.equal(state.nextInput,'PHONE');
});
