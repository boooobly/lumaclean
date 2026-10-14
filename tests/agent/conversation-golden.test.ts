import test from 'node:test';
import assert from 'node:assert/strict';
import {explicitCustomerFacts,applyCustomerFacts} from '../../src/lib/agent/customer-facts';
import {nextQualification} from '../../src/lib/agent/conversion-intake';
import {calculatePrice} from '../../src/lib/pricing';
import type {AgentState} from '../../src/lib/agent/contracts';

export const goldenClientMessages=[
 'Здравствуйте, хочу заказать клининг',
 'Обычная уборка',
 '88',
 'Да, мне нужно холодильник помыть и духовку. Сколько это всё будет стоить?',
 'Обычное загрязнение',
 'Да, я же написал',
 'Да, мне нужно холодильник помыть и духовку. Сколько это всё будет стоить?',
];
test('exact production golden: preserve both appliances and progress to server quote without EXTRAS loop',()=>{
 const state:AgentState={draftFacts:{}};
 const expectedInputs:AgentState['nextInput'][]=[undefined,'SERVICE_TYPE','AREA','EXTRAS','SOIL_LEVEL',undefined,undefined];
 for(const [i,text] of goldenClientMessages.entries()){
  applyCustomerFacts(state,explicitCustomerFacts(text,new Date('2026-10-14T12:00:00Z'),'Europe/Belgrade',expectedInputs[i],state),'2026-10-14');
  if(i>=1)assert.equal(state.draftFacts?.service,'regular');
  if(i>=2)assert.equal(state.draftFacts?.area,88);
  if(i>=3){assert.deepEqual([...(state.draftFacts?.extras??[])].sort((a,b)=>a.code.localeCompare(b.code)),[{code:'fridge',quantity:1},{code:'oven',quantity:1}]);assert.equal(state.draftFacts?.extrasConfirmed,true);assert.notEqual(nextQualification(state),'EXTRAS');}
  if(i>=4){assert.equal(state.draftFacts?.soilLevel,'NORMAL');assert.equal(nextQualification(state),undefined);const f=state.draftFacts!;const q=calculatePrice(f.service!,f.area!,f.extras??[],false);assert.equal(q.base,7200);assert.equal(q.total,9200);}
 }
});
test('approved appliance breakdown is 1000 RSD for each confirmed unit',()=>{
 const q=calculatePrice('regular',88,[{code:'fridge',quantity:1},{code:'oven',quantity:1}],false);
 assert.deepEqual(q.extras.map(e=>({code:e.code,unitPrice:e.unitPrice})),[{code:'fridge',unitPrice:1000},{code:'oven',unitPrice:1000}]);
});
