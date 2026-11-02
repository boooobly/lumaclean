import assert from'node:assert/strict';import test from'node:test';
import{NativeTestBudget,NativeTestBudgetError,currentNativeTestBudget,nativeTestFetch,withNativeTestBudget}from'../../src/lib/services/native-test-budget';
import {PoyoProvider,OpenRouterProvider,type AgentMessage} from '../../src/lib/agent/providers';
const request={method:'POST',body:JSON.stringify({model:'gpt-6-luna',max_output_tokens:1200,input:[]})};
test('native diagnostics stops before a third paid model request',()=>{
 const b=new NativeTestBudget('diagnostics');b.authorize('https://api.poyo.ai/v1/responses',request);b.authorize('https://api.poyo.ai/v1/responses',request);
 assert.throws(()=>b.authorize('https://api.poyo.ai/v1/responses',request),NativeTestBudgetError);assert.equal(b.report().attempted.llm,2);assert.throws(()=>b.assertAllowed(),NativeTestBudgetError);
});

test('retry ceilings can only shrink an approved native profile',()=>{
 const booking=new NativeTestBudget('booking',null,{llm:1});booking.authorize('https://api.poyo.ai/v1/responses',request);
 assert.throws(()=>booking.authorize('https://api.poyo.ai/v1/responses',request),NativeTestBudgetError);assert.equal(booking.report().attempted.llm,1);
 const diagnostics=new NativeTestBudget('diagnostics','https://routing.example.test',{routing:5});for(let i=0;i<5;i++)diagnostics.authorize('https://routing.example.test/route');assert.throws(()=>diagnostics.authorize('https://routing.example.test/route'),NativeTestBudgetError);
 for(const lower of[{llm:3},{routing:33},{places:1},{llm:-1},{routing:NaN}])assert.throws(()=>new NativeTestBudget('booking',null,lower),/NATIVE_TEST_PROFILE_NOT_APPROVED/);
});
test('native budget refuses changed models, larger input/output, unknown services and Google calls',()=>{
 for(const [url,init]of[
  ['https://api.poyo.ai/v1/responses',{...request,body:JSON.stringify({model:'different',max_output_tokens:1200})}],
  ['https://api.poyo.ai/v1/responses',{...request,body:JSON.stringify({model:'gpt-6-luna',max_output_tokens:1201})}],
  ['https://api.poyo.ai/v1/responses',{...request,body:'x'.repeat(160001)}],
  ['https://unexpected.example.test/private-token',request],
  ['https://places.googleapis.com/v1/places:autocomplete',request],
 ] as const){const b=new NativeTestBudget('booking');assert.throws(()=>b.authorize(url,init),NativeTestBudgetError);assert.equal(b.report().attempted.llm,0);assert(!JSON.stringify(b.report()).includes('private-token'));}
});
test('native MOTIS budget is bound to its configured origin',()=>{
 const b=new NativeTestBudget('booking','https://routing.example.test');for(let i=0;i<32;i++)b.authorize('https://routing.example.test/route');
 assert.throws(()=>b.authorize('https://routing.example.test/route'),NativeTestBudgetError);assert.equal(b.report().attempted.routing,32);
});

test('recurring diagnostics input is capped at 4096 bytes before paid transport',()=>{
 const budget=new NativeTestBudget('diagnostics');
 assert.throws(()=>budget.authorize('https://api.poyo.ai/v1/responses',{...request,body:JSON.stringify({model:'gpt-6-luna',max_output_tokens:1200,input:'x'.repeat(4096)})}),NativeTestBudgetError);
 assert.equal(budget.report().attempted.llm,0);
});

test('both real provider serializers fit the small diagnostics ceiling with only the connectivity tool (mocked transport)',async()=>{
 let calls=0;
 const budget=new NativeTestBudget('diagnostics');
 const send:typeof fetch=async(input,init)=>{
  budget.authorize(input,init);calls++;const body=JSON.parse(init!.body as string);
  assert.equal(body.tools.length,1);assert.equal(body.tools[0].name??body.tools[0].function.name,'getBusinessInfo');
  return Response.json(String(input).includes('poyo')?{output:[{type:'function_call',call_id:'synthetic',name:'getBusinessInfo',arguments:'{}'}]}:{choices:[{message:{tool_calls:[{id:'synthetic',function:{name:'getBusinessInfo',arguments:'{}'}}]}}]});
 };
 const messages:AgentMessage[]=[{role:'system',content:'Synthetic connectivity check. No customer data or CRM actions. Call getBusinessInfo with {} using native tool calling.',allowedTools:['getBusinessInfo']},{role:'user',content:'Call getBusinessInfo now.'}];
 await new PoyoProvider('gpt-6-luna','synthetic',send).complete(messages);
 await new OpenRouterProvider('openai/gpt-6-luna','synthetic',send).complete(messages);
 assert.equal(calls,2);budget.assertAllowed();
});
test('cached transport references remain bounded and swallowed errors cannot produce PASS',async()=>{
 const before=globalThis.fetch,provider=process.env.LUMACLEAN_ROUTING_PROVIDER;let calls=0;process.env.LUMACLEAN_ROUTING_PROVIDER='MOTIS';
 globalThis.fetch=async()=>{calls++;return Response.json({ok:true});};const cached=nativeTestFetch;
 try{
  await assert.rejects(withNativeTestBudget('diagnostics',async()=>{for(let i=0;i<3;i++)try{await cached('https://api.poyo.ai/v1/responses',request);}catch{/* Simulate a provider fallback swallowing its error. */}return'PASS';}),NativeTestBudgetError);
  assert.equal(calls,2);assert.equal(currentNativeTestBudget(),undefined);
  await cached('https://normal-operation.example.test/');assert.equal(calls,3);
 }finally{globalThis.fetch=before;if(provider===undefined)delete process.env.LUMACLEAN_ROUTING_PROVIDER;else process.env.LUMACLEAN_ROUTING_PROVIDER=provider;}
});
