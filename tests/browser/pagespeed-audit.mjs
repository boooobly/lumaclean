// Regression audit for public pages. All APIs and external traffic are mocked.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const base=process.env.BASE_URL||'http://127.0.0.1:3118';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname)||(process.env.AUDIT_PRODUCTION==='1'&&new URL(base).origin==='https://lumacleanrs.com'));
const phase=process.argv[2]||'after',out=process.env.ARTIFACT_DIR||`artifacts/pagespeed-2026-10-31/${phase}-browser`;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const report={base,phase,mocked:true,pages:[],matrix:[],errors:[],links:[],resources:[],shifts:[]};
await context.addInitScript(()=>{
 localStorage.setItem('lc-analytics-consent-v2','no');
 window.__auditCls=0;
 new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__auditCls+=e.value;}).observe({type:'layout-shift',buffered:true});
});
await context.route('**/*',route=>{
 const r=route.request(),url=new URL(r.url());
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/chat'?{conversation:null}:{allowed:true}});
 if(url.origin!==base)return route.fulfill({status:204});
 assert.ok(['GET','HEAD'].includes(r.method()),`Blocked write ${url.pathname}`);
 return route.continue();
});
const page=await context.newPage();
page.on('pageerror',e=>report.errors.push({url:page.url(),message:e.message}));
page.on('console',m=>{if(m.type()==='error')report.errors.push({url:page.url(),message:m.text()});});
const internal=new Set();
try{
 const sitemap=await (await context.request.get(base+'/sitemap.xml')).text();
 const routes=process.env.AUDIT_PATHS?.split(',')||[...new Set([...sitemap.matchAll(/<loc>https:\/\/lumacleanrs.com([^<]*)<\/loc>/g)].map(m=>m[1]))];
 if(!process.env.AUDIT_PATHS)routes.push(...['ru','sr','en'].flatMap(l=>[`/${l}/privacy-policy`,`/${l}/data-deletion`]));
 const before=phase.startsWith('after')?JSON.parse(await readFile('artifacts/pagespeed-2026-10-31/before-browser/report.json','utf8')):null;
 for(const route of routes){
  await page.setViewportSize({width:1440,height:1000});
  const response=await page.goto(base+route);assert.equal(response.status(),200,route);
  await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');
  const meta=await page.evaluate(()=>({path:location.pathname,lang:document.documentElement.lang,title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,alternates:[...document.querySelectorAll('link[hreflang]')].map(e=>({lang:e.hreflang,href:e.href})),h1:[...document.querySelectorAll('h1')].map(e=>e.textContent),jsonLd:[...document.querySelectorAll('script[type="application/ld+json"]')].map(e=>JSON.parse(e.textContent)),text:document.querySelector('main')?.innerText,hrefs:[...document.querySelectorAll('a[href]')].map(e=>e.getAttribute('href'))}));
  assert.equal(meta.lang,route.split('/')[1]);assert.equal(meta.h1.length,1,route);assert.ok(meta.description);assert.equal(meta.canonical,'https://lumacleanrs.com'+route);
  assert.equal(meta.alternates.length,4,route);
  if(before){
   const previous=before.pages.find(p=>p.path===route);
   // This change intentionally adds an accessibility-only action description.
   // Compare all pre-existing business copy, including prices and conditions.
   const actionElement=page.locator('#up-gallery-action');
   const action=await actionElement.count()?await actionElement.textContent():null;
   const normalize=text=>text?.replace(/\s+/g,' ').trim();
   assert.deepEqual({...meta,text:normalize(action?meta.text.replace(action,''):meta.text),hrefs:undefined},{...previous,text:normalize(previous.text),hrefs:undefined},`Content/metadata changed ${route}`);
  }
  for(const href of meta.hrefs){const u=new URL(href,base+route);if(u.origin===base){if(u.hash&&u.pathname===route)assert.ok(await page.locator(`[id="${decodeURIComponent(u.hash.slice(1))}"]`).count(),`Missing anchor ${route} ${u.hash}`);if(!u.pathname.startsWith('/api/'))internal.add(u.pathname);}}
  for(const width of [375,768,1440]){
   await page.setViewportSize({width,height:1000});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${route} width ${width}`);
   report.matrix.push({route,width,height:1000,status:'PASS'});
  }
  report.pages.push(meta);console.log(`PASS ${route}`);
 }
 for(const route of internal){const r=await context.request.get(base+route);report.links.push({route,status:r.status()});assert.ok(r.status()<400,`Broken link ${route}`);}
 for(const width of [375,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(base+'/ru');await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');
  report.resources.push(await page.evaluate(()=>({width:innerWidth,images:[...document.images].map(i=>({class:i.className,src:i.currentSrc,loading:i.loading,priority:i.fetchPriority})),requests:performance.getEntriesByType('resource').map(e=>({url:e.name,bytes:e.transferSize,duration:e.duration})),fonts:[...document.querySelectorAll('link[as="font"]')].map(e=>e.href)})));
  await page.screenshot({path:`${out}/home-${width}.png`});
  for(const [name,selector] of [['bathroom','.bathroom-infographic'],['rates','#rates']]){
   if(width===1440&&name==='bathroom')continue;
   await page.locator(selector).scrollIntoViewIfNeeded();await page.locator(selector).screenshot({path:`${out}/${name}-${width}.png`});
  }
  report.shifts.push({width,cls:await page.evaluate(()=>window.__auditCls)});
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
