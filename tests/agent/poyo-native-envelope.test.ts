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
test('PoYo string-union arguments retain original calculator values; competing branches are not decoded',()=>{
 const args='{"service":"regular","area":50,"extras":[],"soilLevel":"NORMAL","urgent":false}';
 const output=(argumentsValue:unknown)=>[{type:'function_call',call_id:'native-id',name:'calculatePrice',arguments:argumentsValue,content:null}];
 for(const alternate of [null,{},args])assert.equal(normalizeCompletion('poyo','gpt-6-luna','responses',{output:output({OfString:args,OfResponseToolSearchCallArguments:alternate})},1).toolCalls[0].arguments,args);
 assert.equal(normalizeCompletion('poyo','gpt-6-luna','responses',{output:output({OfString:'',OfResponseToolSearchCallArguments:args})},1).toolCalls[0].arguments,args);
 assert.equal(normalizeCompletion('poyo','gpt-6-luna','responses',{output:output({OfString:'',OfResponseToolSearchCallArguments:JSON.parse(args)})},1).toolCalls[0].arguments,args);
 const conflicting={OfString:args,OfResponseToolSearchCallArguments:{area:1}};
 assert.equal(normalizeCompletion('poyo','gpt-6-luna','responses',{output:output(conflicting)},1).toolCalls[0].arguments,JSON.stringify(conflicting));
});
