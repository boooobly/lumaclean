import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
const base=process.env.PRO_HTTP_TEST_URL;assert.equal(base,'http://localhost:3128');
const mode=process.argv[2]??'healthy';assert(['healthy','db-down'].includes(mode));
const statuses=[];
for(const authorization of [undefined,'Bearer wrong','Bearer synthetic-pro-cron-local-onlý','Bearer synthetic-pro-cron-local-only']){
 const r=await fetch(base+'/api/notifications/recover',{headers:authorization?{authorization}:{},redirect:'manual',signal:AbortSignal.timeout(15000)});
 const valid=authorization==='Bearer synthetic-pro-cron-local-only';assert.equal(r.status,valid?(mode==='healthy'?200:503):401);
 assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('x-robots-tag'),/noindex/);
 const b=await r.json();assert.equal(b.ok,valid&&mode==='healthy');
 assert(!JSON.stringify(b).includes('postgres'));assert(!JSON.stringify(b).includes('Synthetic recipient'));
 statuses.push({authorization:valid?'valid':authorization?'invalid':'missing',status:r.status});
}
const parallel=mode==='healthy'?await Promise.all([1,2,3].map(async()=>{const r=await fetch(base+'/api/notifications/recover',{headers:{authorization:'Bearer synthetic-pro-cron-local-only'}});assert.equal(r.status,200);return r.status;})):[];
writeFileSync(`artifacts/vercel-pro-20261101/release-verification/recovery-http-${mode}.json`,JSON.stringify({mode,status:'PASS',scope:'Actual local HTTP/PG; no external credentials',statuses,parallel},null,2));console.log(JSON.stringify({mode,status:'PASS',checks:statuses.length+parallel.length}));
