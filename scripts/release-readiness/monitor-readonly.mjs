// Manual probe: no cookies, credentials, POST, CRM reads or notification sends.
import {performance} from 'node:perf_hooks';
const origin=process.argv[2]||'https://lumacleanrs.com';
const u=new URL(origin);if(!['lumacleanrs.com','localhost','127.0.0.1'].includes(u.hostname))throw Error('Unapproved probe origin');
const results=[];
for(const path of ['/ru','/sr','/en','/api/booking-policy','/robots.txt','/sitemap.xml']){
 const start=performance.now();
 try{const r=await fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(15000),cache:'no-store'});results.push({path,status:r.status,ms:Math.round(performance.now()-start),ok:r.status===200});await r.body?.cancel();}
 catch{results.push({path,ok:false,error:'UNREACHABLE_OR_TIMEOUT'});}
}
console.log(JSON.stringify({at:new Date().toISOString(),origin,results}));
process.exitCode=results.every(r=>r.ok)?0:1;
