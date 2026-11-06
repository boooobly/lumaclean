// Verify progressive enhancement without sending any application requests.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {servicePages as pages} from './service-routes.mjs';
const drivers=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const base=process.env.BASE_URL||'http://127.0.0.1:3114';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname));
const output=process.env.ARTIFACT_DIR||'artifacts/services-stage4/enhancement';
await mkdir(output,{recursive:true});
const report={mocked:true,checks:[],errors:[]};
for(const engine of ['chromium','webkit']){
 const browser=await drivers[engine].launch({headless:true,...engine==='chromium'?{channel:'chrome'}:{}});
 try{
  for(const mode of ['normal','observer-failure','animation-failure','no-js']){
   const context=await browser.newContext({viewport:{width:320,height:1000},javaScriptEnabled:mode!=='no-js',reducedMotion:'no-preference'});
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==base)return route.fulfill({status:204});
    assert.ok(['GET','HEAD'].includes(req.method()),'Unexpected write blocked');
    if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/chat'?{conversation:null}:{allowed:false}});
    return route.continue();
   });
   await context.addInitScript(({mode})=>{
    localStorage.setItem('lc-analytics-consent-v2','no');
    window.__serviceAnimations=[];
    const animate=Element.prototype.animate;
    Element.prototype.animate=function(frames,options){if(this.closest('.service-page'))window.__serviceAnimations.push({duration:options.duration,faq:this.matches('.service-faq details')});if(this.matches('.service-faq details')&&window.__failNextFaqAnimation){window.__failNextFaqAnimation=false;throw Error('Synthetic unavailable animation');}return animate.call(this,frames,options);};
    if(mode==='observer-failure'){
     const Observer=window.IntersectionObserver;
     window.IntersectionObserver=new Proxy(Observer,{construct(Target,args){if(args[1]?.rootMargin==='0px 0px -20px 0px'){window.__serviceObserverFailure=true;throw Error('Synthetic service observer failure');}return Reflect.construct(Target,args);}});
    }
   },{mode});
   const page=await context.newPage();page.on('pageerror',error=>report.errors.push(error.message));
   for(const item of pages.filter(p=>p.locale==='en')){
    const requests=[];const observe=request=>requests.push(request.url());page.on('request',observe);
    await page.goto(base+item.path);await page.waitForLoadState('networkidle');await page.evaluate(()=>document.fonts.ready);
    const otherServices=requests.filter(url=>url.includes('%2Fmedia%2Fservices%2F')&&!url.includes(`%2F${item.id}.webp`));assert.deepEqual(otherServices,[],'Unneeded service images loaded');page.off('request',observe);
    for(const selector of ['h1','.service-scope-visual','.service-included-list','.service-detail-grid','.service-faq','.estimate-sheet'])assert.equal(await page.locator(selector).first().isVisible(),true);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    if(mode==='observer-failure')await page.waitForFunction(()=>window.__serviceObserverFailure===true);
    if(mode==='normal'){
     await page.locator('.service-scope').scrollIntoViewIfNeeded();await page.waitForFunction(()=>window.__serviceAnimations.some(a=>a.duration===360));
     const faq=page.locator('.service-faq details').last();await faq.locator('summary').focus();await page.keyboard.press('Enter');
     await page.waitForFunction(()=>window.__serviceAnimations.some(a=>a.faq&&a.duration===240));
     // Change the preference during an active disclosure; final state must settle safely.
     await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.target?.closest?.('.service-page')));
     assert.equal(await faq.getAttribute('open'),'');assert.equal(await faq.locator('p').isVisible(),true);
     await faq.locator('summary').press('Enter');assert.equal(await faq.getAttribute('open'),null);
     await page.emulateMedia({reducedMotion:'no-preference'});
    }
    if(mode==='animation-failure'){
     await page.locator('.service-faq').scrollIntoViewIfNeeded();
     await page.evaluate(()=>{const summary=document.querySelector('.service-faq summary');summary.click();window.__failNextFaqAnimation=true;summary.click();});
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     assert.equal(await page.locator('.service-faq details').first().getAttribute('open'),'','Failed animation must preserve the latest requested open state');
     assert.equal(await page.locator('.service-faq details').first().evaluate(el=>el.style.overflow),'');
     await page.locator('.service-faq summary').first().press('Enter');await page.waitForFunction(()=>!document.querySelector('.service-faq details').open);
    }
    report.checks.push({engine,mode,id:item.id,width:320,status:'PASS'});
   }
   await context.close();
  }
 }finally{await browser.close();}
}
assert.deepEqual(report.errors,[]);report.status='PASS';await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,checks:report.checks.length,unexpectedErrors:report.errors.length}));
