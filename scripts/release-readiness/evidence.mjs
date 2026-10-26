// Re-certifies the tested WEBSITE release; explicitly refuses to certify AI AUTO.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceFingerprint,sourceInventory,verifiedRelease} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/release-readiness/';
const read=path=>readFileSync(root+path,'utf8');
const json=path=>JSON.parse(read(path));
function testLog(path,min){const text=read(path),pass=Number([...text.matchAll(/(?:ℹ |# )?pass (\d+)/g)].at(-1)?.[1]);assert(pass>=min,path);assert(/fail 0\b/.test(text),path);return pass;}
const checks={unit:testLog('unit-all.log',1044),client:testLog('client-ssr.log',15),admin:testLog('admin-core-final.log',43),finance:testLog('finance-final.log',16),reliability:testLog('reliability-final.log',18)};
assert(read('typecheck.log').includes('Types generated successfully')&&!/error TS\d/.test(read('typecheck.log')));
assert(!/\b[1-9]\d* errors?\b/.test(read('lint.log')));
assert(read('build.log').includes('prerendered as static content')&&!/Failed to compile|Build error occurred/.test(read('build.log')));
assert(read('prisma-validate.log').includes('schema.prisma is valid'));
assert(read('prepare.log').includes('No difference detected.')&&read('prepare.log').includes('five databases, no drift'));
const reports=['browser-conversion','browser-navigation','browser-estimate-chat','browser-upholstery'].map(dir=>json(dir+'/report.json'));
for(const report of reports){assert.equal((report.errors??report.pageErrors).length,0);if(report.status)assert.equal(report.status,'PASS');}
assert.equal(reports[0].calculations,135);assert.equal(reports[2].scenarios.length,13);
assert.equal(json('seo.json').issues.length,0);
const receipt=json('production-smoke.json').beforeDeployReceipt;
assert.equal(receipt.deliveryState,'DELIVERED');assert.equal(receipt.attempts,1);assert.equal(receipt.telegramMessageId,'52');
const previous=JSON.parse(readFileSync('release/ai-go-live.json','utf8')),files=sourceInventory();
for(const path of Object.keys(files).filter(path=>path.startsWith('prisma/migrations/')))assert.equal(files[path],previous.files[path],`No production migration authorized: ${path}`);
const evidence={fingerprint:sourceFingerprint(),files,tests:Object.values(checks).reduce((a,b)=>a+b,0),lint:true,typecheck:true,migration:true,build:true,aiAutoReady:false,releaseProfile:'WEBSITE_MANUAL_AI_OFF',checkedAt:new Date().toISOString(),checks,
  suites:['Full unit suite: 1044 PASS, 33 environment-dependent skips; 15 client SSR tests PASS','Isolated PostgreSQL: 43 admin/CRM/scheduling/routing, 16 finance and 18 reliability/upholstery tests PASS','93 desktop/mobile layout checks RU/SR/EN; 135 calculator cases; mocked browser writes; 69-page SEO check'],
  verificationScope:'Website-only release with AI_AGENT_ENABLED=false. New upholstery HTTP intake verified against disposable loopback PostgreSQL and current approved catalogue. One separately authorized production synthetic enquiry reached existing outbox, Queue and administrative Telegram (message 52); no client messages or real customer changes. Schema annotations reconciled to existing migration DDL; 25 migrations replayed on five local databases with zero drift, production migrations untouched. AI automatic-booking legacy integration run: 28 PASS / 27 FAIL, so aiAutoReady=false keeps AI_VERIFIED_RELEASE=false even when this source fingerprint matches. No live AI booking or provider readiness claimed. Google/Yandex account verification and actual analytics receipt documented separately.',
  previousVerification:{fingerprint:previous.fingerprint,tests:previous.tests,checkedAt:previous.checkedAt}};
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');
assert.equal(verifiedRelease().verified,false,'Website evidence must not open AI AUTO');
writeFileSync(root+'release-evidence-summary.json',JSON.stringify({fingerprint:evidence.fingerprint,tests:evidence.tests,checks,releaseProfile:evidence.releaseProfile,aiAutoReady:false},null,2)+'\n');
console.log(JSON.stringify({fingerprint:evidence.fingerprint,tests:evidence.tests,profile:evidence.releaseProfile,AI_VERIFIED_RELEASE:false}));
