import assert from 'node:assert/strict';
import test from 'node:test';
import scenarios from './fixtures/behavior-corpus.json';
import {mandatoryHandoff,substantiveIntent,outputAllowed} from '../../src/lib/agent/policy';
import {replyFacts} from '../../src/lib/agent/chat-presentation';
import {resolveCustomerDate} from '../../src/lib/agent/temporal';
import {explicitCustomerFacts} from '../../src/lib/agent/customer-facts';
import {transparencyAnswer} from '../../src/lib/agent/persona';
import type {AgentLocale} from '../../src/lib/agent/contracts';
const received=new Date('2026-10-04T10:00:00+02:00');
test('regression corpus is bounded, non-PII and covers eighteen categories and four languages',()=>{
  assert.equal(scenarios.length,112);assert.equal(new Set(scenarios.map(s=>s.category)).size,18);assert.equal(new Set(scenarios.map(s=>s.locale)).size,4);
  assert(!/\+381|@gmail|sk-or-|https?:\/\//u.test(JSON.stringify(scenarios)));
});
for(const scenario of scenarios)test(`corpus ${scenario.id} [${scenario.locale}]`,()=>{
  const {kind,text,expected}=scenario;
  if(kind==='handoff')assert.equal(mandatoryHandoff(text),expected);
  else if(kind==='intent')assert.equal(substantiveIntent(text),expected);
  else if(kind==='transparency')assert.equal(!!transparencyAnswer(text,scenario.locale as AgentLocale,'Mila'),expected);
  else if(kind==='date')assert.equal(resolveCustomerDate(text,received,'Europe/Belgrade'),expected);
  else if(kind==='output')assert.equal(outputAllowed(text,{}),expected);
  else if(kind==='reply'){const f=replyFacts(text);assert.equal(f.soilLevel??f.service??(f.extrasConfirmed?'extras':undefined),expected);}
  else if(kind==='facts'){const f=explicitCustomerFacts(text,received,'Europe/Belgrade');for(const [key,value] of Object.entries(expected as object))assert.deepEqual(f[key as keyof typeof f],value);}
  else assert.fail(`Unknown scenario kind ${kind}`);
});
