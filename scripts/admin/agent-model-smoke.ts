/** Paid, synthetic adapter compatibility probe. No CRM or outbound channels. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {nativeTools} from '../../src/lib/agent/contracts';
import {normalizeCompletion} from '../../src/lib/agent/providers';

async function main(){
 if(!process.argv.includes('--live'))throw Error('LIVE_OPT_IN_REQUIRED');
 const key=process.env.OPENROUTER_API_KEY;
 if(!key||key==='[SENSITIVE]')throw Error('OPENROUTER_KEY_REQUIRED');
 const response=await fetch('https://openrouter.ai/api/v1/models',{signal:AbortSignal.timeout(22000)});
 if(!response.ok)throw Error('MODEL_CATALOG_UNAVAILABLE');
 const catalog=await response.json();
 const rows=[];
 for(const id of ['openai/gpt-6-luna','anthropic/claude-haiku-5.5']){
  const metadata=catalog.data.find((m:{id:string})=>m.id===id);
  const row:{[key:string]:unknown}={id,canonical:metadata?.canonical_slug,metadata,settings:{max_tokens:1600,reasoning:{effort:'low',exclude:true},provider:{require_parameters:true}},status:'INCONCLUSIVE'};
  rows.push(row);
  if(!metadata||!['tools','tool_choice','reasoning','max_tokens'].every(p=>metadata.supported_parameters.includes(p)))continue;
  const messages:unknown[]=[{role:'system',content:'Synthetic adapter smoke. First call getBusinessInfo with empty args. After its result, return one short Serbian sentence about supplies. Never call another tool.'},{role:'user',content:'Da li donosite svoja sredstva?'}];
  const calls=[];
  for(let step=0;step<2;step++){
   const started=Date.now();
   try{
    const r=await fetch('https://openrouter.ai/api/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model:id,messages,tools:nativeTools,...row.settings as object}),signal:AbortSignal.timeout(22000)});
    if(!r.ok){calls.push({error:'PROVIDER_HTTP_'+r.status});break;}
    const data=await r.json();
    const c=normalizeCompletion('openrouter',id,'chat',data,Date.now()-started,{input:0.1,output:0.5});
    calls.push({text:c.text,tools:c.toolCalls.map(t=>({name:t.name,args:t.arguments})),usage:data.usage,model:data.model,latencyMs:c.latencyMs,finishReason:data.choices?.[0]?.finish_reason});
    if(step===0){
     if(c.toolCalls.length!==1||c.toolCalls[0].name!=='getBusinessInfo'||c.toolCalls[0].arguments.trim()!=='{}')break;
     messages.push(data.choices[0].message,{role:'tool',tool_call_id:c.toolCalls[0].id,content:JSON.stringify({suppliesIncluded:true})});
    }else if(c.text.trim()&&!c.toolCalls.length)row.status='PASS';
   }catch{calls.push({error:'PROVIDER_UNAVAILABLE'});break;}
  }
  row.calls=calls;
 }
 mkdirSync('qa-output',{recursive:true});
 writeFileSync('qa-output/llm-first-model-smoke.json',JSON.stringify({at:new Date().toISOString(),rows},null,2));
 console.log(JSON.stringify(rows.map(r=>({model:r.id,status:r.status,canonical:r.canonical,calls:r.calls}))));
}
main().catch(()=>{console.error('SMOKE_FAILED');process.exitCode=1;});
