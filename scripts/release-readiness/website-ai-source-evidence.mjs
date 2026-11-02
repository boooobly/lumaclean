// Software source admission only. Native proof and production readiness are separate gates.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFingerprint,sourceInventory,verifiedRelease} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/website-ai-activation-20261102/';
assert.equal(sourceFingerprint(),'fbff1ffcb5fb03a1d9ec32c36d9acd5ce45a299ed9984c4b236b3399b408b801','Rerun checks after source changes');
const checks={};
for(const [file,minimum]of [['full',1069],['integration',59],['release-verification/admin',40]]){
 const log=readFileSync(root+file+'.log','utf8'),count=k=>Number([...log.matchAll(new RegExp('(?:ℹ |# )'+k+' (\\d+)','g'))].at(-1)?.[1]??-1);
 assert(count('pass')>=minimum&&count('fail')===0,file);checks[file]={pass:count('pass'),fail:0,skip:count('skipped'),sha256:createHash('sha256').update(log).digest('hex')};
}
assert.equal(readFileSync(root+'tsc.log','utf8').trim(),'');
assert.match(readFileSync(root+'lint.log','utf8'),/0 errors/);
assert.match(readFileSync(root+'build.log','utf8'),/prerendered as static content/);
assert.match(readFileSync(root+'validate.log','utf8'),/schema.prisma is valid/);
assert.match(readFileSync(root+'drift.log','utf8'),/No difference detected/);
const old=JSON.parse(readFileSync('release/ai-go-live.json','utf8'));
const evidence={fingerprint:sourceFingerprint(),files:sourceInventory(),tests:checks.full.pass,lint:true,typecheck:true,migration:true,build:true,
 aiAutoReady:true,releaseProfile:'WEBSITE_AI_SOURCE_TESTED_NATIVE_PENDING',productionReady:false,nativeBookingVerified:false,cloudPreviewCertified:false,
 checkedAt:new Date().toISOString(),checks,vercelConfigSha256:createHash('sha256').update(readFileSync('vercel.json')).digest('hex'),
 verificationScope:'Software source admission for protected native-verification Preview. Unit/domain and real loopback PostgreSQL/HTTP checks passed with explicitly mocked external providers. This is NOT native certification or production admission. Runtime readiness still independently requires real provider diagnostics, approved operational rules/crew, signed source/config-bound fresh Preview booking proof, owner confirmation and production maintenance configuration. No production mode is enabled by this file.',
 previousVerification:{fingerprint:old.fingerprint,checkedAt:old.checkedAt}};
writeFileSync(root+'pre-native-source-evidence.json',JSON.stringify({source:evidence.fingerprint,checks,nativeCalls:0,productionReady:false},null,2));
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');
assert.equal(verifiedRelease().verified,true);console.log(JSON.stringify({softwareSourceMatches:true,fingerprint:evidence.fingerprint,nativeBookingVerified:false,productionReady:false}));
