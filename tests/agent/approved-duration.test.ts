import assert from 'node:assert/strict';import test from 'node:test';
import {approvedWebsiteDuration} from '../../src/lib/services/approved-duration-rules';
import {estimateDuration} from '../../src/lib/domain/duration';
test('owner-approved 25–120m² model uses existing duration engine and stays inactive until versioned application',()=>{
 for(const service of ['regular','deep'] as const){
  const rule=approvedWebsiteDuration(service,{id:'prospective',serviceId:service,version:2},30);assert.equal(rule.active,false);
  const rules=[{...rule,active:true}],input={serviceId:service,area:50,soilLevel:'NORMAL',requiredCleaners:2,extras:[]};
  for(const [area,regular,deep]of [[25,60,180],[40,100,290],[50,120,360],[60,145,435],[80,195,580],[100,240,720],[120,290,865]]){
   const r=estimateDuration({...input,area},rules)!;assert.equal(r.estimatedDurationMinutes,service==='regular'?regular:deep);assert.equal(r.cleaningReserveMinutes,30);
  }
  for(const area of [24.99,120.01,180])assert.equal(estimateDuration({...input,area},rules),null);
  assert.equal(estimateDuration({...input,area:59.99},rules)!.ruleId,rule.id);
  assert.equal(estimateDuration({...input,requiredCleaners:1},rules),null);
  assert.equal(estimateDuration({...input,extras:[{code:'oven',quantity:1}]},rules),null);
  for(const soilLevel of ['LIGHT','HEAVY','EXTREME'])assert.throws(()=>estimateDuration({...input,soilLevel},rules),/коэффициент/);
 }
});
