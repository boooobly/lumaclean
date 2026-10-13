import assert from 'node:assert/strict';
import test from 'node:test';
import {normalizeCompletion} from '../../src/lib/agent/providers';
test('observed PoYo native object arguments and null content retain function identity',()=>{
 const output=[{type:'function_call',call_id:'native-id',name:'getBusinessInfo',arguments:{},content:null}];
 const result=normalizeCompletion('poyo','gpt-6-luna','responses',{status:'completed',output},1);
 assert.deepEqual(result.toolCalls,[{id:'native-id',name:'getBusinessInfo',arguments:'{}'}]);assert.equal(result.text,'');
 assert.throws(()=>normalizeCompletion('poyo','gpt-6-luna','responses',{output:[{...output[0],arguments:[]}]},1));
 assert.throws(()=>normalizeCompletion('poyo','gpt-6-luna','responses',{output:[{...output[0],arguments:{value:'x'.repeat(8000)}}]},1));
 assert.throws(()=>normalizeCompletion('poyo','gpt-6-luna','responses',{output:[{...output[0],call_id:undefined}]},1));
});
test('pseudo tool JSON in assistant text remains text, never a native call',()=>{
 const text='{"name":"createOrder","arguments":{}}';
 const result=normalizeCompletion('poyo','gpt-6-luna','responses',{output:[{type:'message',content:[{type:'output_text',text}]}]},1);
 assert.equal(result.text,text);assert.deepEqual(result.toolCalls,[]);
});
