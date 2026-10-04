/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS verification runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  vm.runInNewContext(code,{exports,require:id => id in mocks ? mocks[id] : id.startsWith('@/') ? load(`src/${id.slice(2)}.ts`,mocks,globals) : id.startsWith('.') ? load(require('node:path').resolve(require('node:path').dirname(file),`${id}.ts`),mocks,globals) : require(id),console,URL,URLSearchParams,Date,Response,Request,AbortSignal,process,crypto:require('node:crypto').webcrypto,...globals},{filename:file});
  return exports;
}
const analytics = load('src/lib/analytics.ts');
const safe=analytics.safeEventData({locale:'ru',service:'deep',channel:'telegram',destination:'/ru?phone=private',name:'private',phone:'private',comment:'private'},['/ru']);
assert.deepEqual(JSON.parse(JSON.stringify(safe)),{locale:'ru',service:'deep',channel:'telegram'});
assert.equal(analytics.sourceFromReferrer('https://www.google.rs/search?q=private'),'google');
assert.equal(analytics.sourceFromReferrer('https://google.com.attacker.example/'),'referral');

const jsx = {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function renderEstimate({valid=true,responseOk=true,bodyOk=true,reject=false,pending=false}={}) {
  let stateIndex=0; const states=[]; const events=[]; let requests=0; let release; let payload;
  const values=['regular',55,{standardWindow:0,largeWindow:0,cabinets:0,ironing:0},{},false,valid?'Test':'','12345678','',true,'idle'];
  const hooks={useMemo:fn=>fn(),useRef:value=>({current:value}),useState:()=>{const i=stateIndex++;return[values[i],value=>states.push(value)];}};
  const mod=load('src/components/site/estimate.tsx',{
    react:hooks,'react/jsx-runtime':jsx,'next/image':()=>null,'lucide-react':{Minus:()=>null,Plus:()=>null},
    '@/lib/pricing':{serviceIds:['regular'],calculatePrice:()=>({base:4600,total:4600,extras:[],surcharge:0}),extrasPrices:{},formatRsd:v=>String(v)},
    '@/lib/analytics':{trackEvent:(...args)=>events.push(args),leadAttribution:()=>undefined},
    '@/components/site/arrow-icon':{ArrowIcon:()=>null},
  },{fetch:async(_url,options)=>{requests++;payload=JSON.parse(options.body);if(pending) await new Promise(resolve=>release=resolve);if(reject)throw Error('network');return {ok:responseOk,json:async()=>({ok:bodyOk})};}});
  const tree=mod.Estimate({locale:'ru',copy:{calculation:'Estimate',total:'Total'},content:{pricing:{serviceNames:{regular:'Regular'}},calculator:{labels:{}}}});
  return {submit:()=>tree.props.onSubmit({preventDefault(){}}),events,states,requests:()=>requests,payload:()=>payload,release:()=>release?.()};
}
(async()=>{
  for(const scenario of [{}, {responseOk:false}, {bodyOk:false}, {reject:true}, {valid:false}]) {
    const test=renderEstimate(scenario); await test.submit();
    const expected=Object.keys(scenario).length===0?'generate_lead':'lead_error';
    assert.equal(test.events.at(-1)[0],expected);
    if (scenario.valid!==false) assert.equal(test.payload().service,'regular');
    if(scenario.valid===false)assert.equal(test.requests(),0);
  }
  const duplicate=renderEstimate({pending:true}); const first=duplicate.submit(); await duplicate.submit(); assert.equal(duplicate.requests(),1); duplicate.release(); await first; assert.equal(duplicate.events.filter(e=>e[0]==='generate_lead').length,1);


  const retry=renderEstimate({reject:true}); await retry.submit(); const retryId=retry.payload().submissionId; await retry.submit(); assert.equal(retry.payload().submissionId,retryId);
  const logLines=[]; let notifications=0; let unavailable=false; const stored=new Map();
  const input={name:'Test',phone:'12345678',consent:true,locale:'ru',service:'regular',area:55,urgent:false,extras:[],submissionId:require('node:crypto').randomUUID()};
  const api=load('src/app/api/lead/route.ts',{
    '@/lib/articles':{articlePath:()=>'',getPublishedArticles:()=>[]},'@/lib/seo-services':{getServicePath:()=>'/ru/services/uborka-kvartir'},'@/i18n/routing':{routing:{locales:['ru','sr','en']}},
    '@/lib/database/client':{getDatabase:()=>({})},
    '@/lib/services/website-leads':{saveWebsiteLead:async(_db,payload)=>{if(unavailable)throw Error('database unavailable');const exists=stored.has(payload.submissionId);const reference=stored.get(payload.submissionId)||'LC-20261001-ABCDEF12';stored.set(payload.submissionId,reference);return{id:'mock',reference,created:!exists};},notifyWebsiteLead:async()=>{notifications++;}}
  },{console:{log:v=>logLines.push(v),warn:v=>logLines.push(v),error:v=>logLines.push(v)}});
  const post=body=>api.POST(new Request('https://example.test/api/lead',{method:'POST',body:JSON.stringify(body)}));
  assert.equal((await post({})).status,400);assert.equal(notifications,0);
  assert.equal((await post(input)).status,200);assert.equal(notifications,1);
  assert.equal((await post(input)).status,200);assert.equal(notifications,1);assert.equal(stored.size,1);
  unavailable=true;assert.equal((await post({...input,submissionId:require('node:crypto').randomUUID()})).status,503);
  assert(!logLines.join().includes('Test'));assert(!logLines.join().includes('12345678'));
  console.log('PASS: no PII in analytics/logs, source classification, validation/server/network errors, stable retry UUID, duplicate click protection, storage errors and mocked API persistence. Telegram success/failure and real database idempotency covered by tests/crm. No real enquiries sent.');

})().catch(error=>{console.error(error);process.exitCode=1;});
