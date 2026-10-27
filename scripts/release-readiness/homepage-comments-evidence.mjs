// Record fresh evidence for the two-file homepage correction; keep AI disabled.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceInventory,sourceFingerprint} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/homepage-comments/';
const read=file=>readFileSync(root+file,'utf8');
const passed=file=>{const log=read(file);assert.match(log,/fail 0\b/);return Number([...log.matchAll(/pass (\d+)/g)].at(-1)[1]);};
const unit=passed('unit-all.log'),client=passed('client.log');
assert.equal(unit,1044);assert.equal(client,15);
assert.match(read('lint.log'),/0 errors/);
assert.match(read('typecheck.log'),/Types generated successfully/);assert.doesNotMatch(read('typecheck.log'),/error TS\d/);
assert.match(read('build.log'),/prerendered as static content/);
for(const file of ['after.json','webkit/after.json','extras/after.json','extras-webkit/after.json']){
 const report=JSON.parse(read(file));assert.deepEqual(report.errors,[]);assert.equal(report.failure,undefined);
 assert.equal(report.matrix.length,15);
 if(report.hover)assert.equal(report.hover.length,84);
 else assert.equal(report.scenarios.length,4);
}
const previous=JSON.parse(readFileSync('release/ai-go-live.json','utf8'));
assert.equal(previous.aiAutoReady,false);assert.equal(previous.releaseProfile,'WEBSITE_MANUAL_AI_OFF');
const files=sourceInventory(),changed=Object.keys(files).filter(file=>files[file]!==previous.files[file]);
assert.deepEqual(changed.sort(),['src/app/styles/homepage-focused.css','src/components/site/extras-ledger.tsx']);
assert.deepEqual(Object.keys(files).sort(),Object.keys(previous.files).sort());
for(const [file,asset] of Object.entries(previous.assets))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),asset.sha256);
writeFileSync(root+'previous-release-evidence.json',JSON.stringify(previous,null,2)+'\n');
const evidence={...previous,fingerprint:sourceFingerprint(),files,tests:unit+client,checkedAt:new Date().toISOString(),checks:{unit,client},
 suites:[`${unit} unit assertions passed; 33 environment-dependent tests skipped`,`${client} client SSR assertions passed`,'Homepage RU/SR/EN × five widths, Chrome and WebKit; 14 photos × two desktop widths × three languages in both engines; touch, keyboard, rapid switching and crossing the second column; API requests mocked'],
 verificationScope:'Incremental homepage presentation correction only: two columns from 768px, three image corner changes, pointer hover intent. Exactly two application source files differ from the previous production inventory; all other source, pricing, CRM, API, agent, booking, Prisma and infrastructure hashes are identical. Existing 21 image assets match their previous SHA256 hashes. migration=true is retained solely for unchanged schema/migration inventory; no migration or production enquiry was run. AI AUTO remains disabled. Production promotion and public smoke are recorded separately.',
 previousVerification:{fingerprint:previous.fingerprint,tests:previous.tests,checkedAt:previous.checkedAt}};
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({fingerprint:evidence.fingerprint,changed,tests:evidence.tests,aiAutoReady:false}));
