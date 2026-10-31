// Lab audit. Writes/APIs/telemetry are mocked on both local and authorized live URLs.
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
const root=process.env.AUDIT_TOOLS_ROOT;
if(!root)throw Error('Set AUDIT_TOOLS_ROOT to the external Lighthouse installation');
const {default:lighthouse}=await import(pathToFileURL(path.join(root,'lighthouse/core/index.js')));
const {default:puppeteer}=await import(pathToFileURL(path.join(root,'puppeteer-core/lib/puppeteer/puppeteer-core.js')));
const phase=process.argv[2]||'before';
const base=process.env.BASE_URL||'http://127.0.0.1:3118';
const target=new URL(base);
if(!['127.0.0.1','localhost'].includes(target.hostname)&&!(process.env.AUDIT_PRODUCTION==='1'&&target.origin==='https://lumacleanrs.com'))throw Error('Local URL or explicit LumaClean production audit required');
const out=process.env.AUDIT_OUTPUT||`artifacts/pagespeed-2026-10-31/${phase}`;
await mkdir(out,{recursive:true});
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const chrome=await chromium.launch({channel:'chrome',headless:true,args:['--remote-debugging-port=9224']});
const browser=await puppeteer.connect({browserURL:'http://127.0.0.1:9224'});
const results=[];
const routes=(process.env.AUDIT_ROUTES||'/ru').split(',');
try{
 for(const route of routes)for(const device of (process.env.AUDIT_DEVICES||'mobile,desktop').split(','))for(let run=1;run<=Number(process.env.AUDIT_RUNS||2);run++){
  const page=await browser.newPage();
  await page.setRequestInterception(true);
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.pathname.startsWith('/api/'))return request.respond({status:200,contentType:'application/json',body:JSON.stringify(url.pathname==='/api/chat'?{conversation:null}:{allowed:true})});
   if(!['GET','HEAD'].includes(request.method())|| (url.protocol.startsWith('http')&&url.origin!==base))return request.respond({status:204});
   return request.continue();
  });
  const config=device==='desktop'?{extends:'lighthouse:default',settings:{formFactor:'desktop',screenEmulation:{mobile:false,width:1350,height:940,deviceScaleFactor:1,disabled:false},throttling:{rttMs:40,throughputKbps:10240,cpuSlowdownMultiplier:1,requestLatencyMs:0,downloadThroughputKbps:0,uploadThroughputKbps:0}}}:undefined;
  const result=await lighthouse(base+route,{output:['json','html'],logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo']},config,page);
  if(result.lhr.runtimeError)throw Error(JSON.stringify(result.lhr.runtimeError));
  const name=`${route.replaceAll('/','_')}-${device}-${run}`;
  await writeFile(`${out}/${name}.json`,JSON.stringify(result.lhr,null,2));
  await writeFile(`${out}/${name}.html`,result.report[1]);
  const a=result.lhr.audits;
  const row={route,device,run,scores:Object.fromEntries(Object.entries(result.lhr.categories).map(([k,v])=>[k,Math.round(v.score*100)])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift','server-response-time','total-byte-weight'].map(k=>[k,a[k]?.numericValue])),failures:Object.values(a).filter(v=>v.score!==null&&v.score<1&&v.details).map(v=>({id:v.id,title:v.title,value:v.displayValue}))};
  results.push(row);await writeFile(`${out}/summary.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(row));
  await page.close();
 }
}finally{await browser.disconnect();await chrome.close();}
