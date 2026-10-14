import test from 'node:test';
import assert from 'node:assert/strict';
import {conversationStrategy,naturalQuestionIntents,naturalQuestionMatches,answerOrigin} from '../../src/lib/agent/conversation-strategy';
import {OpenRouterProvider,normalizeCompletion} from '../../src/lib/agent/providers';
import {llmFirstDialogues} from './fixtures/llm-first-dialogues';
import {nativeTools,conversationNativeTools} from '../../src/lib/agent/contracts';

test('default and unknown strategy retain HYBRID; only explicit flag enables LLM_FIRST',()=>{
 assert.equal(conversationStrategy(''),'HYBRID');assert.equal(conversationStrategy('unknown'),'HYBRID');assert.equal(conversationStrategy('LLM_FIRST'),'LLM_FIRST');
});
test('native confirmation, scope and slots cannot replace exact server wording',()=>{
 for(const key of ['BOOKING_CONFIRMATION','FACT_CONFIRMATION','APPLIANCE_SCOPE','SLOT_SELECTION','POST_BOOKING','SERVICE_CONFIRMATION'] as const)assert(!naturalQuestionIntents.has(key));
 assert(naturalQuestionIntents.has('SOIL_LEVEL'));
});
test('extraction calls alone never imply that the customer received model wording',()=>{
 assert.equal(answerOrigin(false,true,false,false),'deterministic-only');
 assert.equal(answerOrigin(true,true,false,false),'deterministic quote + LLM response');
 assert.equal(answerOrigin(true,false,true,false),'fallback/recovery');
 assert.equal(answerOrigin(false,false,false,true),'handoff');
});
test('natural wording retains the registered topic and cannot smuggle prices or confirmation',()=>{
 assert(naturalQuestionMatches('SOIL_LEVEL','Da li je zaprljanost normalna ili jaka?'));
 assert(naturalQuestionMatches('AREA','Какая площадь квартиры?'));
 assert(!naturalQuestionMatches('AREA','На какую дату хотите уборку?'));
 assert(!naturalQuestionMatches('AREA','Какая площадь, цена 100 RSD?'));
 assert(!naturalQuestionMatches('BOOKING_CONFIRMATION','Подтверждаете бронирование?'));
});
test('actual usage cost includes provider cache billing and keeps numeric reasoning only',()=>{
 const raw={choices:[{message:{content:'Hello'},finish_reason:'stop'}],usage:{prompt_tokens:1000,completion_tokens:80,prompt_tokens_details:{cached_tokens:900},completion_tokens_details:{reasoning_tokens:20},cost:.000047}};
 const c=normalizeCompletion('openrouter','model','chat',raw,10,{input:1,output:1});
 assert.equal(c.estimatedCostUsd,.000047);assert.equal(c.billedCostUsd,.000047);assert.equal(c.cachedInputTokens,900);assert.equal(c.reasoningTokens,20);
});
test('production adapter request remains 1200; bounded benchmark settings are opt-in',async()=>{
 const requests:Record<string,unknown>[]=[];
 const send:typeof fetch=async (_url,input)=>{requests.push(JSON.parse(String(input?.body)));return new Response(JSON.stringify({choices:[{message:{content:'Hi'},finish_reason:'stop'}]}));};
 await new OpenRouterProvider('model','key',send).complete([{role:'user',content:'Hi'}]);
 await new OpenRouterProvider('model','key',send,undefined,{maxTokens:1600,reasoningEffort:'low'}).complete([{role:'user',content:'Hi'}]);
 assert.equal(requests[0].max_tokens,1200);assert(!('reasoning' in requests[0]));assert.equal(requests[1].max_tokens,1600);assert.deepEqual(requests[1].reasoning,{effort:'low',exclude:true});
 assert.throws(()=>new OpenRouterProvider('model','key',send,undefined,{maxTokens:10000,reasoningEffort:'low'}));
});
test('HYBRID retains the original native wire contract; custom question is exposed only to LLM_FIRST',()=>{
 const hybrid=nativeTools.find(t=>t.function.name==='requestCustomerInput')!.function;
 assert(!('question' in (hybrid.parameters.properties as object)));
 const first=conversationNativeTools('LLM_FIRST').find(t=>t.function.name==='requestCustomerInput')!.function;
 assert('question' in (first.parameters.properties as object));
 assert.deepEqual(conversationNativeTools('HYBRID'),nativeTools);
 assert.equal(conversationNativeTools('LLM_FIRST').length,nativeTools.length);
});
test('48 frozen multi-turn dialogues have split, facts, tools, prohibitions and criteria',()=>{
 assert.equal(llmFirstDialogues.length,48);assert.equal(new Set(llmFirstDialogues.map(s=>s.id)).size,48);
 assert.equal(llmFirstDialogues.filter(s=>s.split==='development').length,16);assert.equal(llmFirstDialogues.filter(s=>s.split==='holdout').length,32);
 for(const s of llmFirstDialogues){assert(s.turns.length>=3);assert(s.forbid.includes('createOrder'));assert(s.must.length>0);assert(s.criteria.length>=5);}
});
