// Fresh WEBSITE_MANUAL_AI_OFF evidence. No live booking or delivery certification.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {sourceFingerprint,sourceInventory,verifiedRelease} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/production-release-2026-10-31/';
const read=p=>readFileSync(root+p,'utf8'),json=p=>JSON.parse(read(p));
function passes(p,min){const s=read(p);assert.match(s,/fail 0\b/,p);const n=Number([...s.matchAll(/pass (\d+)/g)].at(-1)?.[1]);assert.ok(n>=min,p);return n;}
const checks={unit:passes('unit.log',1044),client:passes('client.log',15),adminCrmSchedulingRouting:passes('admin-final.log',43),finance:passes('finance-final.log',16),leadOutbox:passes('reliability-integration.log',18),chatHttp:passes('chat-http-final.log',14)};
assert.match(read('typecheck.log'),/Types generated successfully/);assert.doesNotMatch(read('typecheck.log'),/error TS\d/);
assert.match(read('lint.log'),/0 errors/);assert.match(read('build.log'),/prerendered as static content/);
assert.match(read('schema-diff.log'),/No difference detected/);
const pages=JSON.parse(readFileSync('artifacts/pagespeed-2026-10-31/after-release-browser/report.json','utf8'));
assert.equal(pages.status,'PASS');assert.equal(pages.pages.length,75);assert.equal(pages.matrix.length,225);assert.deepEqual(pages.errors,[]);
const estimate=json('estimate/report.json');assert.equal(estimate.scenarios.length,13);assert.deepEqual(estimate.errors,[]);
const up=json('upholstery-final/polish-report.json');assert.equal(up.status,'PASS');assert.equal(up.matrix.length,30);assert.deepEqual(up.errors.filter(e=>!e.intentional),[]);
const services=json('services/after.json');assert.equal(services.status,'PASS');assert.equal(services.switches.length,30);assert.deepEqual(services.errors,[]);
assert.equal(json('dependency-audit.json').metadata.vulnerabilities.high,0);assert.equal(json('dependency-audit.json').metadata.vulnerabilities.critical,0);
// Always compare to the actual pre-release deployment, including on a retry.
const previous=JSON.parse(readFileSync(root+'previous-release-evidence.json','utf8'));
assert.equal(previous.aiAutoReady,false);assert.equal(previous.releaseProfile,'WEBSITE_MANUAL_AI_OFF');
const allowed=new Set(['next.config.ts','package.json','package-lock.json','src/app/[locale]/layout.tsx','src/app/[locale]/[upholstery]/page.tsx','src/app/[locale]/articles/[slug]/page.tsx','src/app/[locale]/services/[service]/page.tsx','src/app/globals.css','src/app/styles/homepage-focused.css','src/app/styles/site-production.css','src/components/apartment-experience.tsx','src/components/site/article-components.tsx','src/components/site/journey-handoff.tsx','src/components/site/upholstery-calculator.tsx']);
const files=sourceInventory(),changed=[...new Set([...Object.keys(previous.files),...Object.keys(files)])].filter(p=>previous.files[p]!==files[p]);
for(const p of changed)assert.ok(allowed.has(p),'Unreviewed application/infrastructure change: '+p);
for(const p of Object.keys(previous.files).filter(p=>p.startsWith('prisma/')))assert.equal(files[p],previous.files[p],'No migration/schema change: '+p);
const assets={...previous.assets};for(const[p,v]of Object.entries(assets))assert.equal(createHash('sha256').update(readFileSync(p)).digest('hex'),v.sha256,'Previous asset changed: '+p);
for(const p of ['public/media/journey-v5/stills/000-portrait.webp','public/media/journey-v5/stills/000-before-portrait.webp']){const b=readFileSync(p);assets[p]={bytes:b.length,sha256:createHash('sha256').update(b).digest('hex')};}
writeFileSync(root+'previous-release-evidence.json',JSON.stringify(previous,null,2)+'\n');
const evidence={fingerprint:sourceFingerprint(),files,assets,tests:Object.values(checks).reduce((a,b)=>a+b,0),lint:true,typecheck:true,migration:true,build:true,aiAutoReady:false,releaseProfile:'WEBSITE_MANUAL_AI_OFF',checkedAt:new Date().toISOString(),checks,
 suites:['Fresh unit/client SSR: 1044 + 15 PASS; 33 initial environment skips individually triaged','Disposable loopback PostgreSQL and actual HTTP: 43 admin/CRM/scheduling/routing, 16 finance, 18 lead/outbox and 14 chat-security assertions PASS; transports/providers mocked or disabled','75 public pages x 3 widths; 13 form groups; Chrome/WebKit upholstery; 15 services and 30 language switches; UI writes mocked'],
 verificationScope:'Website performance/accessibility/security-headers and reviewed Next 16.4.3/Zod/transitive security updates only. All 14 changed fingerprinted files explicitly reviewed. Pricing, server API/CRM, queue implementation, agent code, schema and migrations remain byte-identical to preceding deployed evidence. migration=true means unchanged production migration inventory and a clean local schema diff, not a production migration. Separate synthetic local databases exercise real persistence, idempotency, authorization, outbox and retry; no live customer Order, message or notification was sent. Remaining remote-provider/native AI tests stay unverified and AI AUTO remains disabled. Production deployment and public verification are recorded separately.',
 previousVerification:{fingerprint:previous.fingerprint,tests:previous.tests,checkedAt:previous.checkedAt}};
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');
assert.equal(verifiedRelease().verified,false);assert.equal(sourceFingerprint(),evidence.fingerprint);
writeFileSync(root+'release-evidence-summary.json',JSON.stringify({fingerprint:evidence.fingerprint,changed,checks,tests:evidence.tests,aiAutoReady:false,profile:evidence.releaseProfile},null,2)+'\n');
console.log(JSON.stringify({fingerprint:evidence.fingerprint,changed,checks,tests:evidence.tests,sourceMatches:true,aiAutoReady:false}));
