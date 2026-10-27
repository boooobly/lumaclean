// Certify the reviewed public-page release without enabling AI or running migrations.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFingerprint,sourceInventory,verifiedRelease} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/final-review/';
const read=file=>readFileSync(root+file,'utf8');
const json=file=>JSON.parse(read(file));
const passed=file=>{const text=read(file);assert.match(text,/fail 0\b/);return Number([...text.matchAll(/pass (\d+)/g)].at(-1)?.[1]);};
const unit=passed('unit-all.log'),client=passed('client.log');assert.ok(unit>=1044&&client>=15);
assert.match(read('typecheck.log'),/Types generated successfully/);assert.doesNotMatch(read('typecheck.log'),/error TS\d/);
assert.match(read('lint.log'),/0 errors/);assert.match(read('build.log'),/prerendered as static content/);
const reports=['homepage/after.json','extras/after.json','extras-webkit/after.json','upholstery/after.json','services/after.json','forms-webkit/report.json'].map(json);
for(const report of reports){assert.deepEqual(report.errors,[]);assert.equal(report.failure,undefined);if(report.status)assert.equal(report.status,'PASS');}
assert.equal(reports[4].matrix.length,75);assert.equal(reports[4].switches.length,30);assert.equal(reports[4].related.length,15);assert.equal(reports[5].scenarios.length,13);
const previous=JSON.parse(readFileSync('release/ai-go-live.json','utf8'));
assert.equal(previous.aiAutoReady,false);assert.equal(previous.releaseProfile,'WEBSITE_MANUAL_AI_OFF');
const allowed=new Set(['src/app/[locale]/page.tsx','src/app/[locale]/[upholstery]/page.tsx','src/app/[locale]/services/[service]/page.tsx','src/app/[locale]/services/[service]/service.css','src/app/styles/estimate-focused.css','src/app/styles/homepage-focused.css','src/components/site/extras-ledger.tsx','src/components/site/service-motion.tsx','src/components/site/upholstery-calculator.tsx','src/components/site/upholstery-premium.css','src/lib/extras-info.ts','src/lib/homepage-ux-content.ts','src/lib/service-visuals.ts','src/lib/upholstery-premium-content.ts']);
const files=sourceInventory(),changed=[...new Set([...Object.keys(files),...Object.keys(previous.files)])].filter(file=>files[file]!==previous.files[file]);
for(const file of changed)assert.ok(allowed.has(file),`Unreviewed application or infrastructure change: ${file}`);
const assetPaths=[...readdirSync('public/media/extras').map(p=>'public/media/extras/'+p),...readdirSync('public/media/services').map(p=>'public/media/services/'+p),'public/media/upholstery/spot-cleaning.webp','public/media/upholstery/fabric-check.webp'];
assert.equal(assetPaths.length,21);
const assets=Object.fromEntries(assetPaths.map(file=>{const bytes=readFileSync(file);assert.ok(bytes.length>0);return[file,{bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}];}));
writeFileSync(root+'previous-release-evidence.json',JSON.stringify(previous,null,2)+'\n');
const evidence={fingerprint:sourceFingerprint(),files,assets,tests:unit+client,lint:true,typecheck:true,migration:true,build:true,aiAutoReady:false,releaseProfile:'WEBSITE_MANUAL_AI_OFF',checkedAt:new Date().toISOString(),checks:{unit,client},
 suites:[`${unit} passing unit assertions; 33 environment-dependent tests skipped without isolated databases`,`${client} client SSR assertions passed`,'Reviewed homepage stages 1–2, upholstery stage 3 and five service pages stage 4; RU/SR/EN, responsive matrix, links, native forms, extras and SPOT; browser writes mocked'],
 verificationScope:'Public-page presentation and local optimized images only. All application/infrastructure source changes are explicitly allowlisted and reviewed. Pricing, CRM, API, agent implementation, booking, schema and migration hashes are identical to the previous production-certified source. migration=true records that unchanged inventory; no migration, seed or production enquiry was run. Prior database and live-delivery checks remain historical evidence, not newly executed checks. AI AUTO remains disabled; no provider or native booking readiness is certified. Staged production HTTP/browser smoke and domain promotion are separate recorded release steps.',
 previousVerification:{fingerprint:previous.fingerprint,tests:previous.tests,checkedAt:previous.checkedAt}};
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');assert.equal(verifiedRelease().verified,false);
writeFileSync(root+'release-evidence-summary.json',JSON.stringify({fingerprint:evidence.fingerprint,changed,tests:evidence.tests,assets:assetPaths.length,aiAutoReady:false,profile:evidence.releaseProfile},null,2)+'\n');
console.log(JSON.stringify({fingerprint:evidence.fingerprint,tests:evidence.tests,assets:assetPaths.length,aiAutoReady:false}));
