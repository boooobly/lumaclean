/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS verification runner. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function load(file, mocks = {}, globals = {}) {
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText;
  const exports = {};
  vm.runInNewContext(code,{exports,require:id => id in mocks ? mocks[id] : require(id),console,URL,URLSearchParams,Date,Response,Request,AbortSignal,process,...globals},{filename:file});
  return exports;
}
const analytics = load('src/lib/analytics.ts');
const safe=analytics.safeEventData({locale:'ru',service:'deep',channel:'telegram',destination:'/ru?phone=private',name:'private',phone:'private',comment:'private'},['/ru']);
assert.deepEqual(JSON.parse(JSON.stringify(safe)),{locale:'ru',service:'deep',channel:'telegram'});
assert.equal(analytics.sourceFromReferrer('https://www.google.rs/search?q=private'),'google');
assert.equal(analytics.sourceFromReferrer('https://google.com.attacker.example/'),'referral');

const jsx = {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
function renderEstimate({valid=true,responseOk=true,bodyOk=true,reject=false,pending=false}={}) {
  let stateIndex=0; const states=[]; const events=[]; let requests=0; let release;
  const values=['regular',55,{standardWindow:0,largeWindow:0,cabinets:0,ironing:0},{},false,valid?'Test':'','12345678','',true,'idle'];
  const hooks={useMemo:fn=>fn(),useRef:value=>({current:value}),useState:()=>{const i=stateIndex++;return[values[i],value=>states.push(value)];}};
  const mod=load('src/components/site/estimate.tsx',{
    react:hooks,'react/jsx-runtime':jsx,'next/image':()=>null,'lucide-react':{Minus:()=>null,Plus:()=>null},
    '@/lib/pricing':{serviceIds:['regular'],basePrice:()=>4600,extrasPrices:{},formatRsd:v=>String(v)},
    '@/lib/analytics':{trackEvent:(...args)=>events.push(args),leadAttribution:()=>undefined},
  },{fetch:async()=>{requests++;if(pending) await new Promise(resolve=>release=resolve);if(reject)throw Error('network');return {ok:responseOk,json:async()=>({ok:bodyOk})};}});
  const tree=mod.Estimate({locale:'ru',copy:{calculation:'Estimate',total:'Total'},content:{pricing:{serviceNames:{regular:'Regular'}},calculator:{labels:{}}}});
  return {submit:()=>tree.props.onSubmit({preventDefault(){}}),events,states,requests:()=>requests,release:()=>release?.()};
}
(async()=>{
  for(const scenario of [{}, {responseOk:false}, {bodyOk:false}, {reject:true}, {valid:false}]) {
    const test=renderEstimate(scenario); await test.submit();
    const expected=Object.keys(scenario).length===0?'generate_lead':'lead_error';
    assert.equal(test.events.at(-1)[0],expected);
    if(scenario.valid===false)assert.equal(test.requests(),0);
  }
  const duplicate=renderEstimate({pending:true}); const first=duplicate.submit(); await duplicate.submit(); assert.equal(duplicate.requests(),1); duplicate.release(); await first; assert.equal(duplicate.events.filter(e=>e[0]==='generate_lead').length,1);

  let networkCalls=0; const oldToken=process.env.TELEGRAM_BOT_TOKEN, oldChat=process.env.TELEGRAM_CHAT_ID;
  process.env.TELEGRAM_BOT_TOKEN='mock'; process.env.TELEGRAM_CHAT_ID='mock';
  const api=load('src/app/api/lead/route.ts',{'@/lib/articles':{articlePath:()=>'',getPublishedArticles:()=>[]},'@/lib/seo-services':{getServicePath:()=>'/ru/services/uborka-kvartir'},'@/lib/pricing':{serviceIds:['regular']},'@/i18n/routing':{routing:{locales:['ru','sr','en']}}}, {fetch:async()=>{networkCalls++;return{ok:true};}});
  assert.equal((await api.POST(new Request('https://example.test/api/lead',{method:'POST',body:'{}'}))).status,400);
  assert.equal(networkCalls,0);
  assert.equal((await api.POST(new Request('https://example.test/api/lead',{method:'POST',body:JSON.stringify({name:'Test',phone:'12345678',consent:true,locale:'ru'})}))).status,200);
  assert.equal(networkCalls,1);
  delete process.env.TELEGRAM_BOT_TOKEN;
  assert.equal((await api.POST(new Request('https://example.test/api/lead',{method:'POST',body:JSON.stringify({name:'Test',phone:'12345678',consent:true})}))).status,503);
  if(oldToken!==undefined) process.env.TELEGRAM_BOT_TOKEN=oldToken;
  if(oldChat!==undefined) process.env.TELEGRAM_CHAT_ID=oldChat; else delete process.env.TELEGRAM_CHAT_ID;
  console.log('PASS: no PII in event fields, source classification, validation/server/network errors, confirmed success, duplicate submit protection, mocked API delivery and missing configuration. No real enquiries sent.');
})().catch(error=>{console.error(error);process.exitCode=1;});
