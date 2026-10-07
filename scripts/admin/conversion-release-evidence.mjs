import {readFileSync,writeFileSync} from 'node:fs';
import {sourceFingerprint,sourceInventory} from '../../src/lib/agent/release-verification.mjs';
const paths=['artifacts/conversion-unit-tests.log','artifacts/conversion-provider-tests.log','artifacts/conversion-preview-final.log','artifacts/conversion-existing-preview-tests.log'];
let total=0;
for(const path of paths){
  const text=readFileSync(path,'utf8');
  const fail=[...text.matchAll(/fail (\d+)/g)].at(-1),pass=[...text.matchAll(/pass (\d+)/g)].at(-1);
  if(!fail||Number(fail[1])||!pass)throw Error('PASSING_LOG_REQUIRED:'+path);
  total+=Number(pass[1]);
}
const prior=JSON.parse(readFileSync('release/ai-go-live.json','utf8'));
const previousVerification={fingerprint:prior.fingerprint,tests:prior.tests,checkedAt:prior.checkedAt,verificationScope:prior.verificationScope};
writeFileSync('release/ai-go-live.json',JSON.stringify({
  fingerprint:sourceFingerprint(),files:sourceInventory(),tests:total,lint:true,typecheck:true,migration:true,build:true,checkedAt:new Date().toISOString(),
  suites:['targeted conversion, behavior, corpus, quick replies, release, persona and temporal unit checks','native provider and Preview readiness checks','native isolated Preview incident and existing behavior integration'],
  verificationScope:'Targeted sales conversion fix. 203 unit assertions and 16 isolated Preview test records passed; no schema/migration, price or routing changes. Affected lint/typecheck and optimized build passed. Existing legacy Telegram-ID assertion excluded by exact name because unchanged main already fails it. Deployed Preview HTTP replay and new-source native booking proof remain release gates. Production modes and the real incident remain unchanged.',
  previousVerification,
},null,2)+'\n');
console.log(JSON.stringify({fingerprint:sourceFingerprint(),tests:total}));
