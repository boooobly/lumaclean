import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationCases} from './fixtures/conversation-corpus';
import {explicitCustomerFacts,applyCustomerFacts} from '../../src/lib/agent/customer-facts';
import {nextQualification} from '../../src/lib/agent/conversion-intake';
import type {AgentState} from '../../src/lib/agent/contracts';
const stable=(value:unknown):unknown=>Array.isArray(value)?value.map(stable).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)])):value;
for(const c of conversationCases)test('conversation corpus: '+c.id,()=>{
 const state:AgentState={draftFacts:structuredClone(c.before??{})};
 const prior=structuredClone(state.draftFacts);
 const facts=explicitCustomerFacts(c.text,new Date('2026-10-14T12:00:00Z'),'Europe/Belgrade',c.question,state);
 applyCustomerFacts(state,facts,'2026-10-14');
 if(c.unchanged)assert.deepEqual(state.draftFacts,prior);
 for(const [key,value] of Object.entries(c.expect??{}))assert.deepEqual(stable(state.draftFacts?.[key as keyof typeof c.expect]),stable(value),key);
 if(c.absent)assert.equal(state.draftFacts?.[c.absent],undefined,c.absent);
 if(c.next)assert.equal(nextQualification(state),c.next);
});
