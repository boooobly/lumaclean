// Source-bound MANUAL evidence only. Never certifies AI AUTO or native/cloud delivery.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {sourceFingerprint,sourceInventory,verifiedRelease} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/vercel-pro-20261101/release-verification/';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
const checks={};
for(const [name,min] of Object.entries({unit:1049,client:15,admin:40,finance:15,reliability:17,recovery:7})){
 const text=readFileSync(root+name+'.log','utf8'),count=k=>Number([...text.matchAll(new RegExp('(?:ℹ |# )'+k+' (\\d+)','g'))].at(-1)?.[1]??-1);
 assert(count('pass')>=min&&count('fail')===0,name);checks[name]={pass:count('pass'),fail:0,skip:count('skipped')};
}
assert.match(readFileSync(root+'build.log','utf8'),/prerendered as static content/);
assert.equal(readFileSync(root+'tsc.log','utf8').trim(),'');
assert.match(readFileSync(root+'lint.log','utf8'),/0 errors/);
assert.match(readFileSync(root+'validate.log','utf8'),/schema.prisma is valid/);
for(const target of ['admin','reliability','recovery'])assert.match(readFileSync(root+target+'-prepare.log','utf8'),/No difference detected/);
for(const mode of ['healthy','db-down'])assert.equal(json(root+'recovery-http-'+mode+'.json').status,'PASS');
const forms=json(root+'forms/report.json'),pages=json('artifacts/pagespeed-2026-10-31/pro-release-browser/report.json'),upholstery=json(root+'upholstery/polish-report.json');
assert.equal(forms.scenarios.length,13);assert.equal(forms.errors.length,0);assert.equal(pages.status,'PASS');assert.equal(pages.matrix.length,225);assert.equal(upholstery.status,'PASS');
const previous=json('release/ai-go-live.json'),files=sourceInventory();
const allowed=new Set(['src/app/api/agent/recover/route.ts','src/app/api/lead/route.ts','src/app/api/notifications/recover/route.ts','src/app/[locale]/layout.tsx','src/app/[locale]/[upholstery]/page.tsx','src/components/site/upholstery-calculator.tsx','src/components/site/website-chat.tsx','src/lib/chat-recap-copy.ts','src/lib/database/client.ts','src/lib/services/cron-auth.ts','src/lib/services/website-notification-recovery.ts','next.config.ts']);
const base='544da114d0a129e9dd9c0f73c047a574af776fd6';
const baseline=JSON.parse(execFileSync('git',['show',base+':release/ai-go-live.json'],{encoding:'utf8'}));
const changed=[...new Set([...Object.keys(files),...Object.keys(baseline.files)])].filter(p=>files[p]!==baseline.files[p]);
assert.equal(changed.length,12);for(const file of changed)assert(allowed.has(file),`Unreviewed application file: ${file}`);
assert.equal(execFileSync('git',['diff','--name-only',base,'--','prisma','src/lib/pricing.ts','src/lib/domain/crm-pricing.ts','src/lib/agent','src/lib/seo.ts'],{encoding:'utf8'}).trim(),'');
const evidence={fingerprint:sourceFingerprint(),files,tests:checks.unit.pass+checks.client.pass,lint:true,typecheck:true,migration:true,build:true,aiAutoReady:false,releaseProfile:'WEBSITE_MANUAL_AI_OFF',checkedAt:new Date().toISOString(),checks,
 verificationScope:'Manual Vercel Pro infrastructure candidate.12 explicit application files reviewed against production544da11. Pricing/duration/SEO/AI runtime/schema/migration SQL unchanged.25 migrations independently replayed on3 fresh local PG18 databases with zero drift. Actual local HTTP/DB regression; external providers and delivery mocked/disabled. Cloud Preview, native Queue/Telegram and production rollout are separate evidence, never inferred from these local PASS results.',
 cloudPreviewCertified:false,productionReady:false,previousVerification:{fingerprint:baseline.fingerprint,checkedAt:baseline.checkedAt},
 vercelConfigSha256:createHash('sha256').update(readFileSync('vercel.json')).digest('hex'),
 browser:{mocked:true,pages:75,layouts:225,forms:13,recapLocales:4,upholsteryLayouts:upholstery.matrix.length},
 nativeDeliveryVerified:false,productionDatabaseChanged:false};
assert.equal(previous.aiAutoReady,false);writeFileSync(root+'previous-manual-evidence.json',JSON.stringify(previous,null,2));
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');assert.equal(verifiedRelease().verified,false);
writeFileSync(root+'source-verification.json',JSON.stringify({fingerprint:evidence.fingerprint,changed,manualSourceMatches:true,aiAutoReady:false,verifiedAiAdmission:false,checks,productionReady:false,configHash:evidence.vercelConfigSha256},null,2));
console.log(JSON.stringify({manualSourceMatches:true,aiAutoReady:false,fingerprint:evidence.fingerprint,unit:checks.unit,tests:evidence.tests}));
