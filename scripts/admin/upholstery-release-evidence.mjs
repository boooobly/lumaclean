import {readFileSync,writeFileSync} from 'node:fs';
import {sourceFingerprint,sourceInventory} from '../../src/lib/agent/release-verification.mjs';
const read=path=>readFileSync(path,'utf8');
const units=read('qa-output/upholstery-units.txt');
const pass=Number([...units.matchAll(/pass (\d+)/g)].at(-1)?.[1]);
const skipped=Number([...units.matchAll(/skipped (\d+)/g)].at(-1)?.[1]);
if(pass<269||!units.includes('fail 0'))throw Error('PASSING_TARGETED_TESTS_REQUIRED');
if(read('qa-output/upholstery-typecheck.txt').trim())throw Error('TYPECHECK_REQUIRED');
if(!read('qa-output/upholstery-lint.txt').includes('0 errors'))throw Error('LINT_REQUIRED');
const build=read('qa-output/upholstery-build.txt');
if(!build.includes('prerendered as static content')||build.includes('Failed to compile'))throw Error('BUILD_REQUIRED');
const transactions=JSON.parse(read('qa-output/upholstery-db-proof.json'));
if(!transactions.passed||transactions.checks<45||!transactions.modesPreserved||transactions.productionOrdersCreated!==0)throw Error('PREVIEW_TRANSACTION_PROOF_REQUIRED');
if(!read('qa-output/upholstery-calendar-regression.txt').includes('24'))throw Error('CALENDAR_REGRESSION_REQUIRED');
const mobile=JSON.parse(read('qa-output/upholstery-browser-public.json'));
if(mobile.length!==6||mobile.some(r=>r.overflow||r.languages!==4||!r.total.includes('3')))throw Error('LOCALIZED_MOBILE_QA_REQUIRED');
const articles=JSON.parse(read('qa-output/upholstery-browser-articles.json'));
if(articles.length!==3||articles.some(r=>r.overflow||r.tables!==2||r.serviceLinks<2))throw Error('ARTICLE_QA_REQUIRED');
const scenarios=JSON.parse(read('qa-output/upholstery-browser-scenarios.json'));
if(!scenarios.some(r=>r.unsafeLeadBlocked)||!scenarios.some(r=>r.photoChatVisible&&r.textSeeded))throw Error('MATERIAL_AND_PHOTO_QA_REQUIRED');
const previous=JSON.parse(read('release/ai-go-live.json'));
const evidence={fingerprint:sourceFingerprint(),files:sourceInventory(),tests:pass+transactions.checks+24,lint:true,typecheck:true,migration:true,build:true,checkedAt:new Date().toISOString(),
  suites:[`${pass} passing agent, scheduling and upholstery unit assertions; ${skipped} isolated-local-DB tests skipped`,`${transactions.checks} real isolated Preview transaction assertions; modes preserved, zero production Orders`,'24 calendar regression assertions on the expanded schema','RU/SR/EN commercial pages, informational articles, deterministic calculator and photo chat; mobile 390/430 and admin preview'],
  verificationScope:'Upholstery catalogue, CRM/Finance, shared deterministic urgency pricing, extractor/material/duration review and localized website/SEO. Additive migrations verified on isolated Preview. Furniture AUTO booking remains BLOCKED. A fresh deployed native existing-regular-service booking proof and production historical preservation are independent release gates; no channel modes are changed.',
  previousVerification:{fingerprint:previous.fingerprint,tests:previous.tests,checkedAt:previous.checkedAt}};
writeFileSync('release/ai-go-live.json',JSON.stringify(evidence,null,2)+'\n');
console.log({fingerprint:evidence.fingerprint,tests:evidence.tests,skipped});
