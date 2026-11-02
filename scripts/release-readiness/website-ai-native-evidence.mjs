// Record genuine protected Preview results. Never import proof or activate production.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {sourceFingerprint,verifiedRelease} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/website-ai-activation-20261102/';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const actual=read(root+'native-cloud-report-v3.json'),cleanup=read(root+'native-cleanup-summary-v3.json'),source=sourceFingerprint();
assert.equal(source,'ff37b27b7936a8148908efaed1b61e1bcacc178449b7ea531415c61eece08f88');
assert.equal(actual.commit,'ce8e9b2939dd5c9743cca352d40aafca3f14c037');assert.equal(actual.deployment,'dpl_ECwhA2RjcNj8JKVv1icFtxdQjoj3');
assert.equal(actual.status,'PASS_NATIVE_TWO_BOOKINGS');assert.equal(actual.bookings.length,2);assert.equal(actual.productionWrites,0);assert.equal(actual.telegramMessages,0);
assert.deepEqual(actual.after,actual.before);assert.equal(actual.after.clients,0);assert.equal(actual.after.orders,0);assert.equal(actual.after.conversations,0);assert.equal(actual.after.messages,0);
for(const key of['primary','fallback','places','transit'])assert.equal(actual.diagnostics[key].ok,true,key);
let llm=2,motis=3;const bookings=[];
for(const[service,minutes]of[['regular',120],['deep',360]]){
 const b=actual.bookings.find(b=>b.service===service);assert(b);assert.equal(b.status,'PASSED');assert.equal(b.cleaned,true);assert(b.steps.every(s=>s.ok));assert.equal(b.booking.estimatedDurationMinutes,minutes);assert.equal(b.booking.assignedCleaners,2);
 assert(b.proof?.passed&&b.proof.cleaned&&/^[a-f0-9]{64}$/.test(b.proof.signature));assert(Date.now()-Date.parse(b.proof.at)<7*86400000);assert.equal(b.nativeBudget.blocked,false);assert.equal(b.nativeBudget.attempted.places,0);
 llm+=b.nativeBudget.attempted.llm;motis+=b.nativeBudget.attempted.routing;
 bookings.push({service,status:'PASS_NATIVE',steps:b.steps.length,minutes,cleaningReserveMinutes:b.booking.cleaningReserveMinutes,travelBufferMinutes:b.booking.travelBufferMinutes,requiredCleaners:2,assignedCleaners:2,price:b.booking.price,cleaned:true,proofAt:b.proof.at,config:b.proof.config});
}
assert.equal(bookings[0].config,bookings[1].config);assert(llm<=6&&motis<=72);assert.equal(cleanup.status,'PASS_OWNED_FIXTURE_CLEANED');assert.equal(cleanup.previewMode,'OFF');
const publicReport=read('release/website-ai-native-20261102.json');
publicReport.status='PASS_NATIVE_PREVIEW_PRODUCTION_PENDING';publicReport.blocker=null;
publicReport.nativeBookings={run:3,pass:2,fail:1,cleaned:true,scope:'Actual isolated Preview; failed historical attempt retained'};
publicReport.successfulAttempt={deployment:actual.deployment,url:actual.base,source:actual.commit,fingerprint:source,diagnostics:{primary:'PASS_NATIVE',fallback:'PASS_NATIVE',places:'PASS_MOTIS',routing:'PASS_DEGRADED_WALKING',liveTransitVerified:false},bookings,transportAttempts:{llm,motis,google:0,telegram:0},cleanup:'PASS',previewModeAfterCleanup:'OFF',productionWrites:0};
publicReport.aggregateTransportAttempts={llm:5+llm,motis:6+motis,google:0,telegram:0};
publicReport.nextAction='Separate owner approval for exact staged production build --prod --skip-domain. Production DB mode remains OFF; no migrations, seed, proof import, duration edits, native calls or promotion. Production configuration/HMAC admission remains unverified until staged checks and approved prospective rule application.';
writeFileSync('release/website-ai-native-20261102.json',JSON.stringify(publicReport,null,2)+'\n');
const evidence=read('release/ai-go-live.json');assert.equal(evidence.fingerprint,source);assert(verifiedRelease().verified);
Object.assign(evidence,{releaseProfile:'WEBSITE_AI_PREVIEW_VERIFIED_PRODUCTION_PENDING',nativeBookingVerified:true,cloudPreviewCertified:true,productionReady:false,nativeEvidence:'release/website-ai-native-20261102.json',nativeScope:'Two real isolated Preview bookings; staff mirror and business records cleaned; actual MOTIS WALKING/fallback routing; production configuration/HMAC compatibility and rollout remain separate gates.'});
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');
console.log(JSON.stringify({sourceMatches:true,nativeBookings:2,cleaned:true,source,attempt:{llm,motis},aggregate:publicReport.aggregateTransportAttempts,productionReady:false}));
