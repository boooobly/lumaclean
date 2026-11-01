// Evidence collector only; does not run providers, recovery or production writes.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {sourceFingerprint,verifiedRelease} from '../../src/lib/agent/release-verification.mjs';
const root='artifacts/audit-20261101/',evidence='docs/audit/evidence/';
const json=p=>JSON.parse(readFileSync(p,'utf8'));
function counts(p){const s=readFileSync(root+p,'utf8'),read=k=>Number([...s.matchAll(new RegExp('(?:ℹ |# )'+k+' (\\d+)','g'))].at(-1)?.[1]??0);return{pass:read('pass'),fail:read('fail'),skip:read('skipped')};}
const log=p=>readFileSync(root+p,'utf8');
const pages=json(root+'public-browser-current/report.json'),forms=json(root+'forms-current/report.json');
const report={
 at:new Date().toISOString(),node:process.version,sourceFingerprint:sourceFingerprint(),releaseCertification:verifiedRelease(),
 productionChanged:false,aiEnabled:false,scope:'Actual local PostgreSQL18.6/HTTP and explicitly MOCKED external providers. Historical lab/production observations are labelled separately.',
 unit:counts('unit.log'),client:counts('client.log'),adminIntegration:counts('integration-admin-pg18.log'),
 financeFresh:counts('integration-finance-pg18.log'),reliabilityFinal:counts('integration-reliability-pg18.log'),chatHttp:counts('integration-chat-http-pg18.log'),
 aiIsolated:{...counts('ai-suite-latest.log'),native:false,externalNetworkDenied:true},
 aiMigration:counts('migrations-ai-pg18.log'),releaseMigration:counts('migrations-reliability-pg18.log'),bootstrap:counts('bootstrap-pg18.log'),
 historicalLegacyAi:{...counts('legacy-ai-integration.log'),current:false,reason:'45 failed children +1parent; fixture/gate/contracts corrected; see ai-suite-reconciliation.json'},
 pages:{status:pages.status,pages:pages.pages.length,matrix:pages.matrix.length,errors:pages.errors.length,mocked:true},
 forms:{scenarios:forms.scenarios.length,viewports:forms.matrix.length,errors:forms.errors.length,writesMocked:true},
 quantities:json(root+'quantities-browser.json'),
 upholstery:existsSync(root+'upholstery-current/polish-report.json')?json(root+'upholstery-current/polish-report.json').status:'NOT_RUN',
 chat:json(root+'chat-after.json'),databaseChat:json(root+'database-chat-measurement.json'),
 historicalLighthouse:{...json(root+'lighthouse-summary.json'),rerunThisContinuation:false,fieldINP:'INCONCLUSIVE'},
 migrationHistory:json(evidence+'migration-parity.json'),schemaObjects:json(evidence+'schema-objects-parity.json'),
 backup:json(evidence+'backup-rehearsal.json'),staging:json(evidence+'staging-smoke.json'),
 checks:{build:/prerendered as static content/.test(log('build.log')),typegen:/Types generated successfully/.test(log('typecheck.log')),tsc:log('tsc.log').trim()==='',prismaValidate:/is valid/.test(log('validate.log')),lint:/0 errors/.test(log('lint.log'))},
 ownerDecisions:{ovenPersonMinutes:45,preserve100SquareJump:true,area:50,crew:2,normalSoilNoExtras:true,regularElapsedMinutes:120,deepElapsedMinutes:360,broaderRulesApproved:false,productionRulesChanged:false},
 openFindings:json(evidence+'open-findings.json'),
 gateA:{status:'BLOCKED',remaining:['hosting operational owner confirmation','remote isolated identity/storage/recipient','bounded live Queue/Telegram proof','recovery SLA/receipt','main ancestry merge and enforced checks','owner-reviewed exact-head rollout']},
 gateB:{status:'BLOCKED',additional:['prospective approved duration rules or explicit point50 canary','native providers/places/routes','bounded signed live booking proof','source-bound readiness certification']},
 nativeLivePassed:false,newVerifiedPreviewDeployment:null
};
writeFileSync(evidence+'verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({unit:report.unit,aiIsolated:report.aiIsolated,admin:report.adminIntegration,checks:report.checks,gateA:report.gateA.status,gateB:report.gateB.status}));
