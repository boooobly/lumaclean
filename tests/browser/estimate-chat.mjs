// Local UI verification: every API and external analytics request is intercepted.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const drivers = await import(process.env.PLAYWRIGHT_CORE_PATH?pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href:'playwright-core');
const engine=process.env.BROWSER_ENGINE||'chromium';
const base = process.env.BASE_URL || 'http://localhost:3107';
const output = path.resolve(process.env.ARTIFACT_DIR||'artifacts/estimate-chat');
await mkdir(output, {recursive:true});
const browser = await drivers[engine].launch({...(engine==='chromium'?{channel:'chrome'}:{}),headless:true});
const report = {mocked:true,engine,base,matrix:[],scenarios:[],errors:[],console:[],metadata:[],links:[]};
const internalLinks=new Set();
const context = await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('lc-analytics-consent-v2','no'));
const state = {writes:[],status:200,offline:false,hold:false,release:null,allowed:true};
await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===base&&url.pathname.startsWith('/__nextjs'))return route.continue();
  if(/google-analytics|googletagmanager|doubleclick/.test(url.hostname))return route.fulfill({status:204});
  if(url.pathname.startsWith('/api/')){
    if(url.pathname==='/api/lead'&&request.method()==='POST'){
      state.writes.push(request.postDataJSON());
      if(state.offline)return route.abort('failed');
      if(state.hold)await new Promise(resolve=>state.release=resolve);
      return route.fulfill({status:state.status,contentType:'application/json',body:JSON.stringify(state.status===200?{ok:true,reference:'LC-MOCK-UI-20261025'}:{ok:false})});
    }
    assert.equal(request.method(),'GET',`Unexpected write blocked: ${url.pathname}`);
    return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname==='/api/chat'?{ok:true,conversation:null}:{allowed:state.allowed})});
  }
  assert.ok(['GET','HEAD'].includes(request.method()),`Unexpected write blocked: ${url.pathname}`);
  return route.continue();
});
const page=await context.newPage();
page.on('pageerror',error=>report.errors.push(error.message));
page.on('console',message=>{
  if(message.type()==='error'){
    const text=message.text(),injected=(state.offline||state.status>=400)&&/Failed to load resource|Failed to fetch/.test(text);
    report.console.push({text,injected});if(!injected)report.errors.push(text);
  }
});
async function go(locale='ru'){
  await page.goto(`${base}/${locale}`);
  await page.locator('#estimate').waitFor();
  await page.evaluate(()=>document.fonts.ready);
}
async function shot(name){
  await page.locator('#estimate').scrollIntoViewIfNeeded();
  const style=await page.addStyleTag({content:'.site-header,.website-chat,nextjs-portal{visibility:hidden!important}'});
  await page.locator('#estimate').screenshot({path:path.join(output,name),animations:'disabled'});
  await style.evaluate(el=>el.remove());
}
async function total(value){
  await page.waitForFunction(expected=>Number(document.querySelector('#estimate .receipt-total output')?.textContent.replace(/\D/g,''))===expected,value);
}
async function area(value){
  await page.locator('#estimate .site-area-range').evaluate((el,value)=>{
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));
    el.dispatchEvent(new Event('input',{bubbles:true}));
    el.dispatchEvent(new Event('change',{bubbles:true}));
  },value);
}
async function fields(){
  const form=page.locator('#estimate');
  await form.locator('[name="name"]').fill('UI fixture');
  await form.locator('[name="phone"]').fill('+381601234567');
  await form.locator('.site-consent input').check();
}
try{
  await go();
  if(process.argv.includes('--before')){
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});
      await shot(`before-ru-${width}.png`);
    }
    await page.goto(`${base}/ru/himchistka-mebeli`);
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('.up-hero-visual').screenshot({path:path.join(output,'reference-upholstery.png')});
    console.log('Baseline and upholstery reference captured');
  }else{
    for(const locale of ['ru','sr','en']){
      await go(locale);
      const form=page.locator('#estimate');
      const metadata=await page.evaluate(()=>({lang:document.documentElement.lang,title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,alternates:[...document.querySelectorAll('link[hreflang]')].map(el=>({lang:el.hreflang,href:el.href})),links:[...document.querySelectorAll('a[href]')].map(el=>el.getAttribute('href'))}));
      assert.ok(metadata.title&&metadata.description);assert.ok(metadata.canonical.endsWith(`/${locale}`));
      assert.ok(metadata.lang.startsWith(locale));
      for(const lang of ['ru','sr','en'])assert.ok(metadata.alternates.some(a=>a.lang===lang));
      metadata.links.filter(href=>href.startsWith('/')&&!href.startsWith('/api/')).forEach(href=>internalLinks.add(href.split('#')[0]));
      const missing=await page.evaluate(()=>[...document.querySelectorAll('a[href^="#"]')].map(a=>a.hash.slice(1)).filter(id=>id&&!document.getElementById(decodeURIComponent(id))));
      assert.deepEqual(missing,[]);report.metadata.push({locale,...metadata,links:undefined});
      assert.ok(!(await form.innerText()).includes('LC-026'));
      assert.equal(await form.locator('.estimate-reference').count(),0);
      for(const width of [1440,1280,1024,768,390,375,320]){
        await page.setViewportSize({width,height:1000});
        const geometry=await form.evaluate(el=>{
          const s=getComputedStyle(el);
          return {corners:[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomLeftRadius,s.borderBottomRightRadius],overflow:document.documentElement.scrollWidth>innerWidth};
        });
        assert.deepEqual(geometry.corners.slice(0,3),['0px','0px','0px']);
        assert.equal(geometry.corners[3],width>900?'100px':width>600?'72px':'48px');
        assert.equal(geometry.overflow,false,`${locale}/${width} overflow`);
        const checks=await form.locator('input[type="checkbox"]').evaluateAll(els=>els.map(el=>{
          const s=getComputedStyle(el);return [s.width,s.height,s.borderRadius,s.borderWidth];
        }));
        checks.forEach(c=>assert.deepEqual(c,['20px','20px','2px','1px']));
        if([1440,390].includes(width))await shot(`after-${locale}-${width}.png`);
        report.matrix.push({locale,width,height:1000,status:'PASS',...geometry});
      }
      console.log(`PASS ${locale}: seven viewports, container geometry, checkboxes, no overflow`);
      await page.setViewportSize({width:1440,height:1000});
      await form.locator('button[type="submit"]').click();
      assert.ok(await form.locator('[role="alert"]').isVisible());
      assert.equal(await form.locator('[aria-invalid="true"]').count(),2);
      await shot(`validation-${locale}.png`);
      await form.locator('.service-options').first().locator('label').nth(1).click();
      await total(11400);
      await area(60);await total(14200);
      await form.locator('.estimate-extras-disclosure > summary').click();
      const counter=form.locator('.site-extra-counter').first();
      await counter.locator('button').last().click();await counter.locator('button').last().click();
      await total(15600);
      for(const check of await form.locator('.site-extra-options input[type="checkbox"]').all())await check.check();
      await total(21250);
      await form.locator('.site-urgent input').check();await total(25550);
      await form.locator('[name="upholsteryRequested"]').check();
      await fields();
      await form.locator('.site-comment summary').click();
      await form.locator('textarea').fill('Synthetic browser check. Mocked submission only.');
      for(const width of [1440,1280,1024,768,390,375,320]){
        await page.setViewportSize({width,height:1000});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`expanded ${locale}/${width}`);
      }
      await page.setViewportSize({width:1440,height:1000});
      await shot(`expanded-filled-${locale}-1440.png`);
      await page.setViewportSize({width:390,height:1000});
      await shot(`expanded-filled-${locale}-390.png`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await form.locator('.estimate-extras-disclosure > summary').click();
      assert.equal(await counter.locator('b').textContent(),'2');
      for(const check of await form.locator('.site-extra-options input[type="checkbox"]').all())assert.equal(await check.isChecked(),true);
      // A failed response can be retried with the SAME idempotency key and payload.
      let before=state.writes.length;
      state.status=503;state.hold=true;
      await form.locator('button[type="submit"]').click();
      await page.waitForFunction(()=>document.querySelector('#estimate')?.getAttribute('aria-busy')==='true');
      await form.evaluate(el=>{el.requestSubmit();el.requestSubmit();});
      await shot(`sending-${locale}.png`);
      assert.equal(state.writes.length,before+1);
      assert.equal(await form.locator('.estimate-reference').count(),0);
      state.release();state.hold=false;
      await form.locator('[role="alert"]').waitFor();
      assert.equal(await form.locator('.estimate-reference').count(),0);
      state.status=200;
      await form.locator('button[type="submit"]').click();
      await form.locator('.estimate-reference').waitFor();
      assert.ok((await form.locator('.estimate-reference').innerText()).includes('LC-MOCK-UI-20261025'));
      assert.equal(state.writes.length,before+2);
      assert.equal(state.writes[before].submissionId,state.writes[before+1].submissionId);
      const payload=state.writes.at(-1);
      assert.equal(payload.locale,locale);assert.equal(payload.requestKind,'CLEANING_UPHOLSTERY');assert.equal(payload.area,60);
      assert.equal(payload.service,'deep');assert.equal(payload.urgent,true);
      assert.equal(payload.extras.find(e=>e.code==='standardWindow').quantity,2);
      assert.match(payload.estimate,/25[\s,.]?550/);
      await shot(`success-${locale}.png`);
      await form.locator('[name="requestKind"]').selectOption('UPHOLSTERY');
      await form.evaluate(el=>el.requestSubmit());
      assert.equal(state.writes.length,before+2,'successful form must remain protected after mode change');
      report.scenarios.push({locale,scenario:'validation/service/area/all checkboxes/disclosure/sending/503/retry/reference/idempotency/mixed',status:'PASS'});
      // Pure cleaning, standalone upholstery, network retry and HTTP validation/rate limit.
      for(const mode of ['CLEANING','UPHOLSTERY']){
        await go(locale);
        if(mode==='UPHOLSTERY')await form.locator('[name="requestKind"]').selectOption(mode);
        await fields();
        before=state.writes.length;
        if(mode==='CLEANING'){
          state.offline=true;
          await form.locator('button[type="submit"]').click();await form.locator('[role="alert"]').waitFor();
          assert.equal(await form.locator('.estimate-reference').count(),0);
          state.offline=false;
          for(const status of [400,429]){
            state.status=status;await form.locator('button[type="submit"]').click();
            await page.waitForFunction(()=>document.querySelector('#estimate')?.getAttribute('aria-busy')==='false');
            assert.ok(await form.locator('[role="alert"]').isVisible());
            assert.equal(await form.locator('.estimate-reference').count(),0);
          }
        }
        state.status=200;
        await form.locator('button[type="submit"]').click();await form.locator('.estimate-reference').waitFor();
        assert.equal(state.writes.at(-1).requestKind,mode);
        if(mode==='UPHOLSTERY')assert.equal(state.writes.at(-1).area,undefined);
        else assert.equal(new Set(state.writes.slice(before).map(w=>w.submissionId)).size,1);
        report.scenarios.push({locale,scenario:`${mode}/network/400/429`,status:'PASS'});
      }
      await go(locale);
      await page.locator('.website-chat-launcher').click();
      const subtitle=await page.locator('.website-chat-panel header p').innerText();
      assert.equal(subtitle,({ru:'Консультация по уборке · Белград',sr:'Informacije o čišćenju · Beograd',en:'Cleaning enquiries · Belgrade'})[locale]);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(output,`chat-${locale}-390.png`)});
      for(const width of [1440,768,320]){
        await page.setViewportSize({width,height:1000});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await page.screenshot({path:path.join(output,`chat-${locale}-${width}.png`)});
      }
      await page.locator('.website-chat-panel').press('Escape');
      state.allowed=false;await go(locale);
      await page.waitForFunction(()=>document.querySelector('#estimate .site-urgent input')?.disabled===true);
      assert.equal(await page.locator('#estimate .site-urgent input').isChecked(),false);
      state.allowed=true;
      const contact=page.locator('.contact-request');
      await contact.locator('button[type="submit"]').click();await contact.locator('[role="alert"]').waitFor();
      await contact.locator('input[type="tel"]').fill('+381601234567');await contact.locator('input[type="checkbox"]').check();
      await contact.locator('button[type="submit"]').click();await contact.locator('[role="status"]').waitFor();
      assert.equal(state.writes.at(-1).requestKind,'CONTACT_REQUEST');
      report.scenarios.push({locale,scenario:'chat at desktop/tablet/mobile, unavailable urgency, mini contact form',status:'PASS'});
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await go();
    await area(180);await area(25);await area(60);await total(8200);
    const visible=await page.locator('#estimate .receipt-total .rate-amount').innerText();
    assert.equal(Number(visible.replace(/\D/g,'')),8200);
    assert.equal(await page.locator('#estimate .service-options span').first().evaluate(el=>getComputedStyle(el).transitionDuration),'0s');
    await fields();await page.locator('#estimate button[type="submit"]').click();await page.locator('.estimate-reference').waitFor();
    assert.equal(state.writes.at(-1).area,60);assert.match(state.writes.at(-1).estimate,/8[\s,.]?200/);
    report.scenarios.push({scenario:'rapid area changes/reduced motion/immediate payload accuracy',status:'PASS'});
    assert.deepEqual(report.errors,[]);
    for(const href of internalLinks){
      const result=await context.request.get(base+href);
      report.links.push({href,status:result.status()});assert.ok(result.ok(),`Broken internal link: ${href} ${result.status()}`);
    }
    for(const href of ['/robots.txt','/sitemap.xml']){
      const result=await context.request.get(base+href);assert.ok(result.ok());report.links.push({href,status:result.status()});
    }
    console.log(`PASS ${report.scenarios.length} scenario groups; writes mocked: ${state.writes.length}; page errors: ${report.errors.length}`);
  }
}finally{
  await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
  await browser.close();
}
