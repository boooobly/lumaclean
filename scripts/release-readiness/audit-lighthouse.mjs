import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const cli=process.env.LIGHTHOUSE_CLI;
if(!cli)throw Error('Set installed LIGHTHOUSE_CLI');
const report={source:'local Lighthouse against production, synthetic lab only',consentBanner:'fresh profile, not hidden or preaccepted',apiAndTelemetry:'blocked; no form writes',runs:[]};
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
for(const path of ['/ru','/ru/himchistka-mebeli'])for(const device of ['mobile','desktop']) {
 const out=`artifacts/audit-20261101/lighthouse-${path==='/ru'?'home':'upholstery'}-${device}.json`;
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--remote-debugging-port=19123']});
 const args=[cli,'https://lumacleanrs.com'+path,'--quiet','--port=19123','--hostname=127.0.0.1','--only-categories=performance,accessibility,best-practices,seo','--output=json',`--output-path=${out}`,...['*api/lead*','*api/chat*','*api/upholstery*','*google-analytics*','*googletagmanager*','*mc.yandex*'].map(p=>'--blocked-url-patterns='+p),...(device==='desktop'?['--preset=desktop']:[])];
 let r;
 try{r=await new Promise(resolve=>{const child=spawn(process.execPath,args,{windowsHide:true,env:{...process.env,NO_PROXY:'localhost,127.0.0.1'},timeout:180000});let stderr='';child.stderr.on('data',c=>stderr+=c);child.on('error',e=>resolve({status:null,stderr:e.message}));child.on('exit',status=>resolve({status,stderr}));});}
 finally{await browser.close();}
 const run={path,device,exit:r.status};
 if(r.status===0){const p=JSON.parse(readFileSync(out,'utf8'));Object.assign(run,{scores:Object.fromEntries(Object.entries(p.categories).map(([k,v])=>[k,Math.round(v.score*100)])),lcp:p.audits['largest-contentful-paint'].numericValue,tbt:p.audits['total-blocking-time'].numericValue,cls:p.audits['cumulative-layout-shift'].numericValue});}
 else run.error=(r.stderr??r.error?.message??'').slice(-500);
 report.runs.push(run);console.log(JSON.stringify(run));writeFileSync('artifacts/audit-20261101/lighthouse-summary.json',JSON.stringify(report,null,2));
}
