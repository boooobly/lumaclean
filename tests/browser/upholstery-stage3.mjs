// Local, read-only UI checks: every API and external request is intercepted.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const drivers=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const engine=process.env.BROWSER_ENGINE||'chromium';
const base=process.env.BASE_URL||'http://127.0.0.1:3113';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output=path.resolve(process.env.ARTIFACT_DIR||'artifacts/upholstery-stage3');
const before=process.argv.includes('--before');
await mkdir(output,{recursive:true});
const browser=await drivers[engine].launch({headless:true,...engine==='chromium'?{channel:'chrome'}:{}});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.addInitScript(()=>{
  localStorage.setItem('lc-analytics-consent-v2','no');
  // The server-rendered gallery can appear before the calculator effect registers.
  // Observe readiness without dispatching a selection or altering product state.
  const add=window.addEventListener;
  window.addEventListener=function(type,...args){
    if(type==='lumaclean:upholstery-select')window.__upSelectionReady=true;
    return add.call(this,type,...args);
  };
});
await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/chat'?{conversation:null}:{allowed:false}});
  if(url.origin!==base)return route.fulfill({status:204});
  assert.ok(['GET','HEAD'].includes(request.method()),`Unexpected write blocked: ${request.method()} ${url.pathname}`);
  return route.continue();
});
const page=await context.newPage();
const routes={ru:'/ru/himchistka-mebeli',sr:'/sr/dubinsko-pranje-namestaja',en:'/en/upholstery-cleaning'};
const report={base,engine,mocked:true,content:{},selection:{},matrix:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
async function go(locale){await page.goto(base+routes[locale]);await page.locator('.up-calculator').waitFor();await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>window.__upSelectionReady===true);}
async function content(){return page.evaluate(()=>({gallery:[...document.querySelectorAll('.up-gallery-item')].map(el=>({text:el.textContent,label:el.getAttribute('aria-label')})),method:{title:document.querySelector('#up-method-title').textContent,intro:document.querySelector('.up-method-intro > p:not(.up-kicker)').textContent,steps:document.querySelector('.up-steps').textContent,caption:document.querySelector('.up-textile > span').textContent},prices:document.querySelector('#prices').textContent,faq:document.querySelector('.up-faq').textContent,metadata:{title:document.title,description:document.querySelector('meta[name="description"]').content,canonical:document.querySelector('link[rel="canonical"]').href,schema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(el=>JSON.parse(el.textContent))}}));}
async function selection(){return page.evaluate(()=>({types:[...document.querySelectorAll('.up-type select')].map(el=>el.value),quantities:[...document.querySelectorAll('.up-counter input')].map(el=>el.value),selected:[...document.querySelectorAll('.up-gallery-item.is-selected')].map(el=>el.className),activeItems:[...document.querySelectorAll('.up-furniture')].map(el=>el.dataset.selected),total:document.querySelector('.up-total strong').textContent,lines:document.querySelector('.up-calc-summary').textContent,focus:document.activeElement.id}));}
async function snapshot(name,selector){
  const el=page.locator(selector);await el.scrollIntoViewIfNeeded();
  await page.waitForFunction(s=>[...document.querySelector(s).querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0),selector);
  const style=await page.addStyleTag({content:'.site-header,.website-chat,nextjs-portal{visibility:hidden!important}'});
  await el.screenshot({path:path.join(output,name),animations:'disabled'});
  await style.evaluate(el=>el.remove());
}
const baseline=before?null:JSON.parse(await readFile(path.resolve(process.env.BASELINE_PATH||path.join(output,'before.json')),'utf8'));
try{
  for(const locale of ['ru','sr','en']){
    await page.setViewportSize({width:1440,height:1000});await go(locale);
    report.content[locale]=await content();
    if(!before)assert.deepEqual(report.content[locale],baseline.content[locale]);
    for(const width of [1440,1024,768,390,320]){
      await page.setViewportSize({width,height:1000});
      await snapshot(`${before?'before':'after'}-${locale}-${width}-spot.png`,'.up-gallery-4');
      await snapshot(`${before?'before':'after'}-${locale}-${width}-method.png`,'.up-method');
      const geometry=await page.evaluate(()=>{
        const image=document.querySelector('.up-textile'),r=image.getBoundingClientRect(),intro=document.querySelector('.up-method-intro').getBoundingClientRect(),steps=document.querySelector('.up-steps').getBoundingClientRect();
        const spot=document.querySelector('.up-gallery-4').getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth>innerWidth,image:{width:r.width,height:r.height,bottom:r.bottom},intro:{height:intro.height,bottom:intro.bottom},steps:{height:steps.height,bottom:steps.bottom},spot:{width:spot.width,height:spot.height},fit:getComputedStyle(image.querySelector('img')).objectFit};
      });
      assert.equal(geometry.overflow,false,`${locale}/${width}: overflow`);
      if(!before){
        const old=baseline.matrix.find(m=>m.locale===locale&&m.width===width);
        // Layout engines quantize fractional grid widths differently (1/64 px).
        assert.ok(Math.abs(geometry.spot.width-old.spot.width)<0.1&&Math.abs(geometry.spot.height-old.spot.height)<0.1,`${locale}/${width}: SPOT card size changed`);
        assert.equal(geometry.fit,'cover');
        assert.ok(geometry.image.height>=240);
        if(width>680)assert.ok(Math.abs(geometry.image.bottom-geometry.steps.bottom)<2,`${locale}/${width}: columns not aligned`);
        else assert.ok(geometry.image.height<=340);
        assert.ok((await page.locator('.up-gallery-4 img').getAttribute('src')).includes('spot-cleaning.webp'));
        assert.ok((await page.locator('.up-textile img').getAttribute('src')).includes('fabric-check.webp'));
        assert.ok((await page.locator('.up-gallery-4 img').getAttribute('alt')).length>20);
        assert.ok((await page.locator('.up-textile img').getAttribute('alt')).length>20);
      }
      report.matrix.push({locale,width,height:1000,status:'PASS',...geometry});
    }
    report.selection[locale]=[];
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});await go(locale);
      await page.locator('.up-gallery-4').click();
      await page.waitForFunction(()=>document.querySelector('.up-type select')?.value==='SPOT');
      await page.waitForFunction(()=>document.activeElement.id==='up-furniture-0');
      const first=await selection();assert.deepEqual(first.types,['SPOT']);assert.ok(first.selected[0].includes('up-gallery-4'));assert.equal(Number(first.total.replace(/\D/g,'')),4000);
      await page.locator('.up-gallery-4').click();
      await page.waitForFunction(()=>document.querySelectorAll('.up-type select').length===2);
      await page.waitForFunction(()=>document.activeElement.id==='up-furniture-1');
      const second=await selection();assert.deepEqual(second.types,['SPOT','SPOT']);
      await page.locator('input[name="mode"][value="ADDON"]').check();
      const addon=await selection();assert.equal(Number(addon.total.replace(/\D/g,'')),8000);
      const state={width,first,second,addon};report.selection[locale].push(state);
      if(!before){
        assert.deepEqual(state,baseline.selection[locale].find(s=>s.width===width));
        assert.ok((await page.locator('.up-item-thumb img').first().getAttribute('src')).includes('spot-cleaning.webp'));
        await snapshot(`selected-${locale}-${width}.png`,'.up-gallery-4');
      }
    }
    console.log(`${before?'before':'after'} ${locale}: five viewports and SPOT selection/repeat/addon PASS`);
  }
  if(!before){
    await page.emulateMedia({reducedMotion:'no-preference'});
    await go('ru');await page.locator('.up-method').scrollIntoViewIfNeeded();
    await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.target?.closest?.('.up-method')));
    await snapshot('motion-method-390.png','.up-method');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.up-gallery-4 img').evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
  }
  assert.deepEqual(report.errors,[]);
}finally{await writeFile(path.join(output,`${before?'before':'after'}.json`),JSON.stringify(report,null,2));await browser.close();}
