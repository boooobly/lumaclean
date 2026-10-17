'use client';
import {useState} from 'react';
import {knowledgeScenarios} from '@/lib/agent/knowledge-scenarios';
export function KnowledgePreview(){
 const [scenario,setScenario]=useState(Object.keys(knowledgeScenarios)[0]);
 const [provider,setProvider]=useState('primary');
 const [busy,setBusy]=useState(false);const [results,setResults]=useState<unknown[]>([]);
 async function run(){
  setBusy(true);let conversationId:string|undefined;
  const rows:unknown[]=[];
  async function call(action:string){const response=await fetch('/api/admin/ai/conversation-preview',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,scenario,provider,conversationId})});const data=await response.json();if(!response.ok)throw new Error(data.error);return data;}
  try{const start=await call('start');conversationId=start.conversationId;for(let i=0;i<start.steps;i++){rows.push(await call('turn'));setResults([...rows]);}}
  catch(error){rows.push({status:'INCONCLUSIVE',error:error instanceof Error?error.message:'Failed'});}
  finally{if(conversationId){try{rows.push(await call('cleanup'));}catch{rows.push({cleanup:'FAILED'});}}setResults(rows);setBusy(false);}
 }
 return <main><h1>Native knowledge Preview</h1><p>Fixed synthetic inquiries; current providers; fixtures cleaned after each run. No customer delivery.</p><label>Scenario <select disabled={busy} value={scenario} onChange={e=>setScenario(e.target.value)}>{Object.keys(knowledgeScenarios).map(s=><option key={s}>{s}</option>)}</select></label><label>Provider <select disabled={busy} value={provider} onChange={e=>setProvider(e.target.value)}><option>primary</option><option>fallback</option></select></label><button disabled={busy} onClick={run}>{busy?'Running…':'Run scenario'}</button><pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(results,null,2)}</pre></main>;
}
