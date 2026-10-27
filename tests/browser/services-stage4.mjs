// Local UI regression. No production API or external request is allowed through.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {servicePages} from './service-routes.mjs';
const drivers=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const engine=process.env.BROWSER_ENGINE||'chromium';
const base=process.env.BASE_URL||'http://127.0.0.1:3114';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const before=process.argv.includes('--before');
const output=path.resolve(process.env.ARTIFACT_DIR||'artifacts/services-stage4');
await mkdir(output,{recursive:true});
const config={pages:servicePages};
const baseline=before?null:JSON.parse(await readFile('artifacts/services-stage4/before.json','utf8'));
const browser=await drivers[engine].launch({headless:true,...engine==='chromium'?{channel:'chrome'}:{}});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const state={status:200,offline:false,pending:null,writes:[]};
await context.addInitScript(()=>{
 localStorage.setItem('lc-analytics-consent-v2','no');
 // Observe hydration and animation calls without changing UI state or timing.
 window.__serviceFaqBound=new WeakSet();window.__serviceFaqAnimations=[];
 const add=HTMLElement.prototype.addEventListener;
 HTMLElement.prototype.addEventListener=function(type,...args){if(type==='click'&&this.matches('.service-faq summary'))window.__serviceFaqBound.add(this);return add.call(this,type,...args);};
 const animate=Element.prototype.animate;
 Element.prototype.animate=function(frames,options){if(this.matches('.service-faq details'))window.__serviceFaqAnimations.push(options.duration);return animate.call(this,frames,options);};
});
await context.route('**/*',async route=>{
 const request=route.request(),url=new URL(request.url());
 if(url.origin!==base)return route.fulfill({status:204});
 if(url.pathname.startsWith('/api/')){
  if(url.pathname==='/api/lead'&&request.method()==='POST'){
   state.writes.push(request.postDataJSON());
   if(state.offline)return route.abort('timedout');
   if(state.pending)await state.pending;
   return route.fulfill({status:state.status,json:state.status===200?{ok:true,reference:'LC-STAGE4-MOCK'}:{ok:false}});
  }
  assert.equal(request.method(),'GET',`Blocked API write ${url.pathname}`);
  return route.fulfill({json:url.pathname==='/api/chat'?{conversation:null}:{allowed:false}});
 }
 if(url.pathname.startsWith('/__nextjs'))return route.fulfill({status:204});
 assert.ok(['GET','HEAD'].includes(request.method()),`Blocked write ${request.method()} ${url.pathname}`);
 return route.continue();
});
let page;
const report={engine,base,mocked:true,pages:[],matrix:[],interactions:[],switches:[],related:[],errors:[],console:[],diagnostics:[]};
async function freshPage(){
 // Isolate hard navigations: WebKit can report cancelled Next prefetches against
 // the next document when a still-active page is reused for unrelated cases.
 if(page)await page.close();
 page=await context.newPage();const current=page;
 current.on('pageerror',error=>{report.errors.push(error.message);report.diagnostics.push({page:current.url(),message:error.message,stack:error.stack});});
 current.on('requestfailed',request=>report.diagnostics.push({page:current.url(),request:request.url(),failure:request.failure()}));
 current.on('console',message=>{
  if(message.type()!=='error')return;
  const text=message.text(),injected=(state.offline||state.status>=400)&&/Failed to load resource|Failed to fetch/.test(text);
  report.console.push({text,injected});if(!injected)report.errors.push(text);
 });
}
async function content(){return page.evaluate(()=>({
 title:document.title,meta:[...document.querySelectorAll('meta[name="description"],meta[property^="og:"],meta[name^="twitter:"]')].map(el=>el.outerHTML).sort(),
 alternates:[...document.querySelectorAll('link[rel="canonical"],link[rel="alternate"]')].map(el=>el.outerHTML).sort(),
 schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(el=>JSON.parse(el.textContent)),
 text:Object.fromEntries(['h1','.service-hero-copy > p','.service-overview-copy','.service-price-card','.service-rate-table','.service-example','.service-included-list','.service-suitable','.service-detail-grid','.service-brief','.service-faq','.service-related','.service-reading'].map(s=>[s,document.querySelector(s)?.textContent.replace(/\s+/g,' ').trim()])),
 links:[...document.querySelectorAll('main a')].map(el=>el.getAttribute('href')).sort(),
 service:document.querySelector('.site-service-options input:checked')?.value
}));}
async function capture(file,selector){
 const el=page.locator(selector);await el.scrollIntoViewIfNeeded();
 await page.waitForFunction(s=>[...document.querySelector(s).querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0),selector);
 const style=await page.addStyleTag({content:`nextjs-portal,.website-chat-launcher${selector==='.service-hero'?'':',.site-header'}{visibility:hidden!important}`});
 await el.screenshot({path:path.join(output,file),animations:'disabled'});await style.evaluate(el=>el.remove());
}
async function faqAfterNavigation(){
 await page.waitForFunction(()=>window.__serviceFaqBound.has(document.querySelector('.service-faq summary')));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const previous=await page.evaluate(()=>window.__serviceFaqAnimations.length);
 const first=page.locator('.service-faq details').first();await first.locator('summary').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(count=>window.__serviceFaqAnimations.slice(count).includes(240),previous);
 await page.waitForFunction(()=>!document.querySelector('.service-faq details').open);
 await page.emulateMedia({reducedMotion:'reduce'});
}
try{
 for(const item of config.pages){
  await freshPage();
  await page.setViewportSize({width:1440,height:1000});
  const response=await page.goto(base+item.path);assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');
  if(!before)await page.waitForFunction(()=>window.__serviceFaqBound.has(document.querySelector('.service-faq summary')));
  const data=JSON.parse(JSON.stringify(await content()));report.pages.push({locale:item.locale,id:item.id,path:item.path,...data});
  if(!before)assert.deepEqual(data,Object.fromEntries(Object.entries(baseline.pages.find(p=>p.locale===item.locale&&p.id===item.id)).filter(([k])=>!['locale','id','path'].includes(k))),`${item.path}: content/SEO regression`);
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:1000});
   // Force all lazy content to load before measuring the complete page.
   await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
   report.matrix.push({locale:item.locale,id:item.id,width,overflow,status:overflow?'FAIL':'PASS'});
   if(!before)assert.equal(overflow,false,`${item.path}/${width}: overflow`);
   if(!before){
    const outside=await page.locator('.estimate-sheet :is(input,select,button,textarea)').evaluateAll(elements=>elements.filter(el=>el.getClientRects().length).filter(el=>{const r=el.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5;}).map(el=>el.outerHTML));
    assert.deepEqual(outside,[],`${item.path}/${width}: form control overflow`);
   }
   if(item.locale==='ru'&&[1440,390].includes(width)){
    const name=`${before?'before':'after'}-${item.id}-${width}`;
    await capture(`${name}-hero.png`,'.service-hero');
    await capture(`${name}-scope.png`,'.service-scope');
    await capture(`${name}-details.png`,'.service-details');
    await capture(`${name}-faq.png`,'.service-faq');
   }
   if(!before&&item.locale!=='ru'&&width===320){await capture(`after-${item.locale}-${item.id}-320-hero.png`,'.service-hero');await capture(`after-${item.locale}-${item.id}-320-faq.png`,'.service-faq');}
  }
  if(!before){
   const form=page.locator('.estimate-sheet');
   assert.equal(await form.locator('.service-options input').evaluateAll(inputs=>inputs.findIndex(input=>input.checked)),['regular','deep','move','airbnb','office'].indexOf(item.id));
   const expected={regular:[4900,6000,8200,9800,98],deep:[9900,11400,14200,17000,180],move:[10700,12800,15600,18400,180],airbnb:[4900,5800,7400,9000,90],office:[4900,5800,7400,9000,90]}[item.id];
   assert.deepEqual(await page.locator('.service-rate-table tbody td').evaluateAll(cells=>cells.map(el=>Number(el.childNodes[0].textContent.replace(/\D/g,'')))),expected);
   assert.equal(Number((await form.locator('.receipt-total strong').textContent()).replace(/\D/g,'')),expected[1]);
   const missing=await page.evaluate(()=>[...document.querySelectorAll('main a[href^="#"]')].map(a=>a.hash.slice(1)).filter(id=>id&&!document.getElementById(decodeURIComponent(id))));assert.deepEqual(missing,[]);
   for(const locale of ['ru','sr','en'])assert.equal(await page.locator('.site-header .site-locales a').filter({hasText:locale.toUpperCase()}).getAttribute('href'),config.pages.find(p=>p.locale===locale&&p.id===item.id).path);
   assert.deepEqual((await page.locator('.service-related nav a').evaluateAll(links=>links.map(a=>a.getAttribute('href')))).sort(),config.pages.filter(p=>p.locale===item.locale&&p.id!==item.id).map(p=>p.path).sort());
   // Keyboard activation preserves native details semantics with and without motion.
   await page.emulateMedia({reducedMotion:'no-preference'});
   const first=page.locator('.service-faq details').first();await first.locator('summary').focus();await page.keyboard.press('Enter');
   await page.waitForFunction(()=>!document.querySelector('.service-faq details').open);
   await page.keyboard.press('Enter');await page.waitForFunction(()=>document.querySelector('.service-faq details').open&&!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.target===document.querySelector('.service-faq details')));
   const last=page.locator('.service-faq details').last();await last.locator('summary').click();await last.locator('summary').click();await last.locator('summary').click();
   await page.waitForFunction(()=>{const d=[...document.querySelectorAll('.service-faq details')].at(-1);return d.open&&!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.target===d);});
   assert.equal(await last.locator('p').isVisible(),true);
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.target?.closest?.('.service-page')));
   await page.locator('.service-hero-actions>a').click();await form.waitFor();
   if(item.locale==='ru')for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await capture(`after-${item.id}-${width}-estimate.png`,'.estimate-sheet');}
   await page.setViewportSize({width:390,height:1000});
   const submit=form.locator('button[type="submit"]');state.writes=[];
   await submit.click();await form.locator('.site-form-status.error').waitFor();assert.equal(state.writes.length,0);
   await form.locator('[name="name"]').fill('STAGE4 MOCK');await form.locator('[name="phone"]').fill('+381600000000');await form.locator('.site-consent input').check();
   for(const status of [400,429,503]){state.status=status;await submit.click();await form.locator('.site-form-status.error').waitFor();}
   state.status=200;state.offline=true;await submit.click();await form.locator('.site-form-status.error').waitFor();state.offline=false;
   let release;state.pending=new Promise(resolve=>release=resolve);
   await submit.click();await page.waitForFunction(()=>document.querySelector('.estimate-sheet').getAttribute('aria-busy')==='true');assert.equal(await submit.isDisabled(),true);
   release();state.pending=null;await form.locator('.site-form-status.success').waitFor();assert.ok((await form.locator('.estimate-reference').textContent()).includes('LC-STAGE4-MOCK'));
   assert.equal(new Set(state.writes.map(p=>p.submissionId)).size,1);
   const payload=state.writes.at(-1);assert.equal(payload.service,item.id);assert.equal(payload.locale,item.locale);assert.equal(payload.area,55);assert.equal(payload.requestKind,'CLEANING');
   report.interactions.push({locale:item.locale,id:item.id,status:'PASS',forms:'mocked',faq:'keyboard / rapid reversal / reduced motion'});
   const target=config.pages.find(p=>p.locale===item.locale&&p.id!==item.id);
   await page.locator('.service-related nav a').first().click();await page.waitForURL(base+target.path);await page.waitForLoadState('networkidle');
   assert.equal(await page.locator('.service-options input').evaluateAll(inputs=>inputs.findIndex(input=>input.checked)),['regular','deep','move','airbnb','office'].indexOf(target.id));
   await faqAfterNavigation();report.related.push({from:item.path,to:target.path,status:'PASS'});
  }
  console.log(`${before?'BEFORE':'AFTER'} ${item.locale}/${item.id}: five widths`);
 }
 if(!before){
  for(const id of ['regular','deep','move','airbnb','office'])for(const from of ['ru','sr','en'])for(const to of ['ru','sr','en'].filter(locale=>locale!==from)){
   await freshPage();
   await page.goto(base+config.pages.find(p=>p.id===id&&p.locale===from).path);await page.waitForLoadState('networkidle');
   await page.locator('.site-header .site-locales a').filter({hasText:to.toUpperCase()}).click();await page.waitForURL(base+config.pages.find(p=>p.id===id&&p.locale===to).path);await page.waitForLoadState('networkidle');
   assert.equal(await page.locator('html').getAttribute('lang'),to);await faqAfterNavigation();report.switches.push({id,from,to,status:'PASS'});
  }
 }
 assert.deepEqual(report.errors,[]);
 report.status='PASS';
}finally{await writeFile(path.join(output,`${before?'before':'after'}.json`),JSON.stringify(report,null,2));await browser.close();}
