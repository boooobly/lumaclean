// GET/HEAD only: no Leads, Orders, messages, queue events or live notifications.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const phase=process.argv[2]||'before';
const base=process.env.RELEASE_URL||'https://lumacleanrs.com';
assert.equal(new URL(base).protocol,'https:');
assert.ok(new URL(base).hostname==='lumacleanrs.com'||new URL(base).hostname.endsWith('.vercel.app'));
const rows=[];
const paths=['/ru','/sr','/en','/ru/services/uborka-kvartir','/ru/himchistka-mebeli','/robots.txt','/sitemap.xml','/api/booking-policy','/api/chat','/api/auth/get-session','/api/admin/clients','/api/agent/recover','/admin','/admin/leads','/admin/settings'];
for(const path of paths){
 const r=await fetch(base+path,{redirect:'manual',signal:AbortSignal.timeout(30000)});
 const body=await r.text();
 const headers=Object.fromEntries([...r.headers].filter(([k])=>['location','content-security-policy','x-frame-options','x-content-type-options','referrer-policy','cross-origin-opener-policy','strict-transport-security','x-robots-tag','cache-control'].includes(k)));
 const row={path,status:r.status,headers};rows.push(row);
 if(path.startsWith('/admin')){assert.equal(r.status,307,path);assert.equal(headers.location,'/admin/login');}
 else if(path==='/api/admin/clients'||path==='/api/agent/recover')assert.equal(r.status,401,path);
 else assert.equal(r.status,200,path);
 if(path==='/api/chat')assert.equal(JSON.parse(body).conversation,null);
 if(path==='/api/auth/get-session')assert.equal(JSON.parse(body),null);
 if(/^\/(ru|sr|en)$/.test(path))assert.ok(body.includes(`lang="${path.slice(1)}"`));
 console.log(`${r.status} ${path}`);
}
await mkdir('artifacts/production-release-2026-10-31',{recursive:true});
await writeFile(`artifacts/production-release-2026-10-31/public-${phase}.json`,JSON.stringify({base,at:new Date().toISOString(),rows,status:'PASS'},null,2));
