import assert from 'node:assert/strict';
import test from 'node:test';
import {operationalSummary,pendingHumanStatements} from '../../src/lib/agent/conversation-memory';
import {applyCustomerFacts,explicitCustomerFacts} from '../../src/lib/agent/customer-facts';
import {toolSchemas,type AgentState} from '../../src/lib/agent/contracts';
test('operational memory retains old human corrections beyond recent context without secrets or tool internals',()=>{
 const state:AgentState={draftFacts:{service:'deep',area:60,soilLevel:'NORMAL'},address:{fullAddress:'Synthetic address',proof:'private-location-proof'},duration:{ruleId:'internal-rule-id',version:1,minutes:180,reserve:30,requiredCleaners:2}};
 let summary=operationalSummary(state,null,{admin:{id:'human-correction',text:'Исправлю: площадь 65 м²'}});
 for(let n=0;n<35;n++)summary=operationalSummary(state,summary,{lifecycle:'client message received'});
 assert.equal(pendingHumanStatements(summary)[0].text,'Исправлю: площадь 65 м²');assert(!summary.includes('private-location-proof'));assert(!summary.includes('internal-rule-id'));
 summary=operationalSummary(state,summary,{admin:{id:'credential',text:'API key: sk-private-do-not-store'}});assert(!summary.includes('sk-private-do-not-store'));
});
test('a confirmed correction invalidates dependent quote/slot/recap, unchanged facts preserve them',()=>{
 const state:AgentState={draftFacts:{service:'deep',area:60,soilLevel:'NORMAL',extras:[],extrasConfirmed:true},slots:[{token:'opaque',start:'2030-01-01T09:00:00Z',duration:180}],pending:{slotToken:'opaque',nonce:'opaque',reschedule:false,recap:{service:'deep',area:60,extras:[],address:'Synthetic address',start:'2030-01-01T09:00:00Z',durationMinutes:180,price:12900,currency:'RSD'}}};
 applyCustomerFacts(state,{area:60});assert(state.pending);assert(state.slots);applyCustomerFacts(state,{area:65});assert.equal(state.draftFacts?.area,65);assert.equal(state.pending,undefined);assert.equal(state.slots,undefined);
});
test('unitless last area correction is contextual; unrelated quantities and permission fields cannot mutate facts',()=>{
 assert.equal(explicitCustomerFacts('нет, 65',new Date(),'Europe/Belgrade',undefined,{draftFacts:{area:60}}).area,65);
 assert.equal(explicitCustomerFacts('нет, 65',new Date(),'Europe/Belgrade','WINDOW_COUNTS',{draftFacts:{area:60}}).area,undefined);
 assert.equal(toolSchemas.reconcileHumanContext.safeParse({reviewedMessageIds:['admin'],corrections:[{messageId:'admin',evidence:'скидка',facts:{discountPercent:50,confirmed:true}}]}).success,false);
});
