import test from 'node:test';
import assert from 'node:assert/strict';
import contract from '../../docs/audit/evidence/pricing-contract.json';
import {priceMatrix,extrasPrices,calculatePrice,type ServiceId} from '../../src/lib/pricing';
import {businessKnowledge,searchBusinessKnowledge} from '../../src/lib/agent/knowledge/search';
import {extrasSchema} from '../../src/lib/validation/crm';
test('runtime core bands and extras match the reviewed live Sheets contract',()=>{
 assert.deepEqual(priceMatrix,contract.bands);
 for(const [code,item] of Object.entries(contract.extras))assert.equal(extrasPrices[code as keyof typeof extrasPrices],item.amount,code);
 assert.equal(businessKnowledge.entries.find(e=>e.runtimeCode==='steam')?.autoBook,false);
 assert.equal(businessKnowledge.entries.find(e=>e.runtimeCode==='steam')?.status,'BY_AGREEMENT');
});
test('independent contract oracle covers areas, quantities, urgent, and receipt reconciliation',()=>{
 for(const [service,row] of Object.entries(contract.bands))for(const area of [1,25,39,39.99,40,59,59.99,60,79,79.99,80,99,99.99,100,101,103,120,180,800])for(const linen of [0,1,2,3])for(const urgent of [false,true]) {
  const base=area<40?row[0]:area<60?row[1]:area<80?row[2]:area<100?row[3]:area*row[4];
  const raw=base+linen*750+2*700+1400;
  const expected=Math.ceil(Math.round(raw*(urgent?1.2:1)*100)/100/100)*100;
  const actual=calculatePrice(service as ServiceId,area,[{code:'linen',quantity:linen},{code:'standardWindow',quantity:2},{code:'oven',quantity:1}],urgent);
  assert.equal(actual.total,expected,`${service}/${area}/${linen}/${urgent}`);
  assert.equal(Math.round((actual.base+actual.extras.reduce((n,e)=>n+e.unitPrice*e.quantity,0)+actual.surcharge+actual.roundingAdjustment)*100)/100,actual.total);
 }
});
test('approved crypto information is available in RU/SR/EN without granting booking permission',()=>{
 for(const query of ['Можно оплатить криптой?','Da li primate kripto?','Can I pay with cryptocurrency?']) {
  const entry=searchBusinessKnowledge({query,limit:4}).matches.find(e=>e.code==='RULE-PAY-017');
  assert(entry,query);assert.match(entry.description,/5%/);assert.equal(entry.autoBook,false);assert.equal(entry.autoCalculate,false);
 }
});

test('owner retains the deep and move discontinuities at 100 square metres',()=>{
 for(const [service,below,at,above] of [['deep',17000,18000,18100],['move',18400,18000,18100]] as const){
  assert.equal(calculatePrice(service,99.99,[],false).total,below);
  assert.equal(calculatePrice(service,100,[],false).total,at);
  assert.equal(calculatePrice(service,100.01,[],false).total,above);
 }
});

test('linen is counted per bed in public and CRM payloads, with the existing 100-unit API cap',()=>{
 for(const quantity of [0,1,2,100]){
  assert(extrasSchema.safeParse([{code:'linen',quantity}]).success);
  assert.equal(calculatePrice('regular',55,[{code:'linen',quantity}],false).total,Math.ceil((6000+750*quantity)/100)*100);
 }
 for(const quantity of [-1,1.5,101])assert(!extrasSchema.safeParse([{code:'linen',quantity}]).success);
 assert(!extrasSchema.safeParse([{code:'steam',quantity:2}]).success);
});
