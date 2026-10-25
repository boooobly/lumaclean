// Certify only checks actually recorded for this release. Live booking is a
// separate signed Preview gate; this manifest does not manufacture that proof.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceFingerprint,sourceInventory} from '../../src/lib/agent/release-verification.mjs';
const read=path=>readFileSync(path,'utf8');
const tests=read('artifacts/estimate-chat-release/all-tests.log');
const passed=Number([...tests.matchAll(/pass (\d+)/g)].at(-1)?.[1]);
assert.ok(passed>1000&&/fail 0\b/.test(tests),'PASSING_COMPLETE_TEST_LOG_REQUIRED');
const typecheck=read('artifacts/estimate-chat/typecheck.log');
assert.ok(typecheck.includes('Types generated successfully')&&!/error TS\d/.test(typecheck));
assert.ok(!/\berror\s{2}|\b[1-9]\d* errors?\b/.test(read('artifacts/estimate-chat/lint.log')));
assert.ok(read('artifacts/estimate-chat/build.log').includes('prerendered as static content'));
assert.ok(read('artifacts/estimate-chat/db-validate.log').includes('schema.prisma is valid'));
const previous=JSON.parse(read('release/ai-go-live.json')),files=sourceInventory();
for(const path of Object.keys(files).filter(path=>path.startsWith('prisma/')))
  assert.equal(files[path],previous.files[path],`Unverified database change: ${path}`);
const browser=['artifacts/estimate-chat/report.json','artifacts/estimate-chat/webkit/report.json'].map(p=>JSON.parse(read(p)));
for(const report of browser){assert.equal(report.matrix.length,21);assert.equal(report.errors.length,0);assert.equal(report.scenarios.length,13);}
for(const path of ['artifacts/estimate-chat-release/continuity-long.log','artifacts/estimate-chat-release/continuity-photos.log']){
  const log=read(path);assert.ok(/pass 2\b/.test(log)&&/fail 0\b/.test(log),`TARGETED_NATIVE_REPEAT_REQUIRED:${path}`);
}
assert.ok(/pass 7\b/.test(read('artifacts/estimate-chat-release/continuity-db.log')));
const evidence={fingerprint:sourceFingerprint(),files,tests:passed+9,lint:true,typecheck:true,migration:true,build:true,checkedAt:new Date().toISOString(),
  suites:[`${passed} passing agent, CRM, admin, finance, scheduling, reliability and routing tests; 32 environment-dependent skips`,
    '18 targeted response-context and mocked ingress/claim/runner/persistence checks included above',
    '9 isolated Neon continuity scenarios passed across the initial run and targeted final-source long-history/photo repeats; local HTTP scenario not run',
    'Chrome and WebKit: RU/SR/EN, seven widths, 42 initial layout checks, expanded forms, 50 intercepted writes and 32 public URLs per engine'],
  verificationScope:'Homepage estimate geometry/accessibility, server-returned reference, neutral chat labels, first-response greeting, complete unanswered bursts and monotonic message ordering with preserved receipt dates. Original photo assumptions were updated to verify text and images on their actual separate messages. The remote test client transaction timeout was raised to accommodate workstation-to-Neon latency; runtime settings unchanged. No Prisma/schema/migration, pricing, model/provider, booking or mode configuration change. migration=true certifies unchanged hashes against the prior schema/migration inventory plus Prisma validate; no migration was executed. Browser writes use mocks. Source-bound live Preview booking, provider diagnostics and production proof import are separate release gates, not implied by these tests.',
  previousVerification:{fingerprint:previous.fingerprint,tests:previous.tests,checkedAt:previous.checkedAt}};
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({fingerprint:evidence.fingerprint,tests:evidence.tests,prismaUnchanged:true}));
