// Published UI navigation only. Writes, API traffic and telemetry are intercepted.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {servicePages} from './service-routes.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const base='https://lumacleanrs.com',out='artifacts/production-release-2026-10-31/production-navigation';
await mkdir(out,{recursive:true});
const locales=['ru','sr','en'],up={ru:'himchistka-mebeli',sr:'dubinsko-pranje-namestaja',en:'upholstery-cleaning'};
const pages=[...locales.map(locale=>({locale,id:'home',path:`/${locale}`})),...locales.map(locale=>({locale,id:'upholstery',path:`/${locale}/${up[locale]}`})),...servicePages];
const report={base,mocked:true,switches:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext({viewport:{width:375,height:1000},reducedMotion:'reduce'});
 await context.addInitScript(()=>localStorage.setItem('lc-analytics-consent-v2','no'));
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  assert.ok(['GET','HEAD'].includes(r.method()),'Unexpected write blocked');
  if(u.origin!==base)return route.fulfill({status:204});
  if(u.pathname.startsWith('/api/'))return route.fulfill({json:u.pathname==='/api/chat'?{conversation:null}:{allowed:false}});
  return route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
 for(const source of pages)for(const locale of locales.filter(l=>l!==source.locale)){
  await page.goto(base+source.path);await page.waitForLoadState('networkidle');
  const target=pages.find(p=>p.id===source.id&&p.locale===locale);
  const link=page.locator('.site-locales a').getByText(locale.toUpperCase(),{exact:true});
  assert.equal(await link.getAttribute('href'),target.path);
  await link.click();await page.waitForURL(base+target.path);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('html').getAttribute('lang'),locale);
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  report.switches.push({from:source.path,to:target.path,width:375,status:'PASS'});
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';console.log(JSON.stringify({status:report.status,switches:report.switches.length,errors:report.errors}));
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
