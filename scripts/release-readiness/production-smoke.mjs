// One explicitly authorized synthetic Lead. A replay uses exactly the same payload and submission ID.
import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
const file='artifacts/release-readiness/production-smoke.json';
const existing=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):null;
const payload=existing?.payload??{submissionId:randomUUID(),name:'TEST LumaClean release',phone:'+381653470308',locale:'ru',consent:true,comment:'TEST LumaClean release — synthetic check, not a customer enquiry. DO NOT CALL or create an order. Company public phone used only for this authorized test.',request:{mode:'STANDALONE',urgent:false,items:[{type:'SOFA3',quantity:1,soil:'NORMAL',fabric:'UNKNOWN',size:'standard',material:'',notes:''}]}};
if(!existing)writeFileSync(file,JSON.stringify({payload,attempts:[],scope:'ONE authorized synthetic upholstery enquiry; subsequent requests are identical retries'},null,2)+'\n',{flag:'wx'});
const response=await fetch('https://lumacleanrs.com/api/upholstery/lead',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(30000)});
const body=await response.json();
const saved=JSON.parse(readFileSync(file,'utf8'));saved.attempts.push({at:new Date().toISOString(),status:response.status,body});writeFileSync(file,JSON.stringify(saved,null,2)+'\n');
assert.equal(response.status,200);assert.equal(body.ok,true);assert.match(body.result.reference,/^UP-LEAD-/);
if(existing?.attempts[0]?.body?.result?.reference)assert.equal(body.result.reference,existing.attempts[0].body.result.reference);
console.log(JSON.stringify({status:response.status,reference:body.result.reference,submissionId:payload.submissionId,replay:!!existing}));
