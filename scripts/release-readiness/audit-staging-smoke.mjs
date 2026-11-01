// Actual HTTP + least-privilege PG18. No Telegram/Blob/native credentials or sends.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {isolatedEnvironment} from './environment.mjs';
import {sourceFingerprint} from '../../src/lib/agent/release-verification.mjs';
const base='http://localhost:3108',env=isolatedEnvironment('lumaclean_staging_test',3108),owner=JSON.parse(readFileSync('artifacts/audit-20261101/staging-owner.json','utf8'));
const db=new pg.Client({connectionString:env.DATABASE_URL});await db.connect();
try{
 const identity=(await db.query('SELECT current_database() database,current_user role')).rows[0];assert.equal(identity.database,'lumaclean_staging_test');assert.equal(identity.role,'lumaclean_staging_app');
 const getStatuses=[];for(const path of ['/ru','/sr','/en','/api/booking-policy','/admin/login']){const r=await fetch(base+path);assert.equal(r.status,200,path);getStatuses.push({path,status:r.status});}
 const post=(path,body,cookie='')=>fetch(base+path,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
 const login=await post('/api/auth/sign-in/email',{email:owner.email,password:owner.password});assert.equal(login.status,200);const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
 const rules=[];
 for(const [service,baseMinutes] of [['regular',120],['deep',360]]){
  const body={service,previousId:null,active:false,minArea:50,maxArea:50,referenceArea:50,cleanerCount:2,baseMinutes,minutesPerSquare:0,reserveMinutes:30,unknownExtraReserveMinutes:0,soilMultipliers:{LIGHT:1,NORMAL:1,HEAVY:1,EXTREME:1},extraMinutes:{oven:45},notes:'Synthetic inactive owner-confirmed 50m2 NORMAL anchor; other soil multipliers are unapproved draft placeholders.'};
  const r=await post('/api/admin/finance/duration-rule',body,cookie);assert.equal(r.status,200);const result=await r.json();assert.equal(result.ok,true);rules.push({service,baseMinutes,active:false});
 }
 const quoteBody={submissionId:randomUUID(),name:'Synthetic stage inquiry',phone:'0649999901',locale:'ru',consent:true,requestKind:'CLEANING',service:'regular',area:55,urgent:false,extras:[{code:'linen',quantity:2}]};
 const first=await post('/api/lead',quoteBody),repeat=await post('/api/lead',quoteBody);assert.equal(first.status,200);assert.equal(repeat.status,200);assert.equal((await first.json()).reference,(await repeat.json()).reference);
 const lead=(await db.query('SELECT "estimatedPrice"::text price,"humanReviewRequired" review FROM "Lead" WHERE "submissionId"=$1',[quoteBody.submissionId])).rows;assert.equal(lead.length,1);assert.equal(Number(lead[0].price),7500);
 const extra=(await db.query('SELECT e.quantity::text quantity FROM "LeadExtra" e JOIN "Lead" l ON l.id=e."leadId" WHERE l."submissionId"=$1',[quoteBody.submissionId])).rows;assert.equal(Number(extra[0].quantity),2);
 const notifications=(await db.query('SELECT "deliveryState",count(*)::int count FROM "Notification" GROUP BY "deliveryState"')).rows;
 const settings=(await db.query('SELECT "aiAgentMode","aiChannelModes" FROM "BusinessSettings"')).rows[0];assert.equal(settings.aiAgentMode,'OFF');
 assert.equal((await db.query('SELECT count(*)::int n FROM "Order"')).rows[0].n,0);assert.equal((await db.query('SELECT count(*)::int n FROM "DurationRule" WHERE active')).rows[0].n,0);
 const report={status:'PASS_LOCAL',scope:'Actual local HTTP/PG18; external delivery BLOCKED, not mocked as successful',base,identity,sourceFingerprint:sourceFingerprint(),getStatuses,auth:true,inactiveDurationDrafts:rules,leadIdempotency:true,linenQuantity:2,leadPriceRsd:7500,notifications,ordersCreated:0,aiServer:false,aiSettings:settings,productionAccess:false};
 writeFileSync('docs/audit/evidence/staging-smoke.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.end();}
