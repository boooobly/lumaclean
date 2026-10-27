// Local UI verification only. No API writes or analytics leave the browser.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const drivers=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const engine=process.env.BROWSER_ENGINE||'chromium';
const base=process.env.BASE_URL||'http://127.0.0.1:3112';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const output=path.resolve(process.env.ARTIFACT_DIR||'artifacts/homepage-stage2');
const before=process.argv.includes('--before');
await mkdir(output,{recursive:true});
const browser=await drivers[engine].launch({...engine==='chromium'?{channel:'chrome'}:{},headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(()=>localStorage.setItem('lc-analytics-consent-v2','no'));
const mockRoute=async route=>{
  const req=route.request(),url=new URL(req.url());
  if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/chat'?{conversation:null}:{allowed:false}});
  if(url.origin!==base)return route.fulfill({status:204});
  if(!['GET','HEAD'].includes(req.method())&&!url.pathname.startsWith('/__nextjs'))return route.abort('blockedbyclient');
  return route.continue();
};
await context.route('**/*',mockRoute);
const page=await context.newPage();
const report={base,engine,mocked:true,content:{},matrix:[],scenarios:[],errors:[]};
const imageRequests=new Set();
page.on('request',request=>{const u=new URL(request.url()),asset=u.searchParams.get('url')||u.pathname;if(asset.startsWith('/media/extras/'))imageRequests.add(asset);});
page.on('pageerror',e=>report.errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
async function go(locale){
  await page.goto(base+'/'+locale);await page.locator('.extras-ledger').waitFor();await page.evaluate(()=>document.fonts.ready);
  if(!before)await page.waitForFunction(()=>!matchMedia('(min-width: 1000px) and (hover: hover) and (pointer: fine)').matches||document.querySelector('.extras-experience')?.dataset.floatingEnabled==='true');
}
async function content(){return page.evaluate(()=>({rows:[...document.querySelectorAll('.extras-ledger > div')].map(el=>({title:el.querySelector('strong').textContent,price:el.querySelector('small').textContent})),photos:[...document.querySelectorAll('.material-stories figure')].map(el=>({src:el.querySelector('img').getAttribute('src').split('&w=')[0],caption:el.querySelector('figcaption').textContent})),scope:document.querySelector('#scope').textContent,terms:document.querySelector('#terms').textContent,faq:document.querySelector('#faq').textContent,metadata:document.title}));}
async function shot(name,selector='#services'){
  const hidden=await page.addStyleTag({content:'.site-header,.website-chat,nextjs-portal{visibility:hidden!important}'});
  await page.locator(selector).scrollIntoViewIfNeeded();
  await page.waitForFunction(s=>[...document.querySelector(s).querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0),selector);
  await page.locator(selector).screenshot({path:path.join(output,name),animations:'disabled'});
  await hidden.evaluate(el=>el.remove());
}
async function readyCard(p=page){
  await p.locator('.extra-info-card').waitFor();
  // Resolve and measure the current card in one browser turn: a previous card
  // can be detached between locator resolution and evaluation during fast hover.
  const handle=await p.waitForFunction(()=>{
    const el=document.querySelector('.extra-info-card');if(!el)return false;
    const img=el.querySelector('img');if(!img?.complete||!img.naturalWidth||getComputedStyle(el).opacity!=='1')return false;
    const rect=el.getBoundingClientRect(),caption=el.querySelector('.extra-info-caption').getBoundingClientRect();
    if(!rect.width||!rect.height)return false;
    const text=el.querySelector('h3').getBoundingClientRect(),close=el.querySelector('.extra-info-close').getBoundingClientRect();
    const buttons=[...document.querySelectorAll('.extra-ledger-trigger')].map(b=>b.getBoundingClientRect());
    const overlap=buttons.some(b=>rect.left<b.right&&rect.right>b.left&&rect.top<b.bottom&&rect.bottom>b.top);
    const photos=document.querySelector('.material-stories').getBoundingClientRect();
    return {cards:document.querySelectorAll('.extra-info-card').length,overflow:document.documentElement.scrollWidth>innerWidth,floating:el.dataset.floating==='true',left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,overlap,photoBottom:photos.bottom,captionTop:caption.top,captionBottom:caption.bottom,textTop:text.top,closeBottom:close.bottom,viewportWidth:innerWidth,viewportHeight:innerHeight};
  });
  const geometry=await handle.jsonValue();await handle.dispose();
  assert.equal(geometry.cards,1);assert.equal(geometry.overflow,false);
  assert.equal(geometry.overlap,false,'Card covers a service row');
  assert.ok(geometry.top>=geometry.photoBottom,`Card covers the three original photos: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.textTop>=geometry.closeBottom+8,`Text overlaps close control: ${JSON.stringify(geometry)}`);
  assert.ok(geometry.captionBottom<=geometry.bottom+1);
  if(geometry.floating){assert.ok(geometry.left>=16&&geometry.right<=geometry.viewportWidth-15,JSON.stringify(geometry));assert.ok(geometry.top>=95&&geometry.bottom<=geometry.viewportHeight-15,JSON.stringify(geometry));}
  return geometry;
}
async function viewportShot(name){await page.locator('.extra-info-card').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,name),animations:'disabled'});}
try{
  if(before){
    for(const locale of ['ru','sr','en']){
      await go(locale);report.content[locale]=await content();
      for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await shot(`before-${locale}-${width}.png`);}
    }
  }else{
    const baseline=JSON.parse(await readFile(path.resolve(process.env.BASELINE_PATH||path.join(output,'before.json')),'utf8'));
    for(const locale of ['ru','sr','en']){
      await page.setViewportSize({width:1440,height:1000});imageRequests.clear();await go(locale);
      report.content[locale]=await content();assert.deepEqual(report.content[locale],baseline.content[locale]);
      assert.equal(await page.locator('.extra-info-card').count(),0);
      assert.equal(imageRequests.size,0,'Inactive photos were downloaded');
      const rows=page.locator('.extra-ledger-trigger');assert.equal(await rows.count(),14);
      const keys=await page.locator('.extra-ledger-row').evaluateAll(els=>els.map(el=>el.dataset.extra));
      for(const [index,key] of keys.entries()){
        report.currentCase={locale,key,mode:'desktop'};
        await page.mouse.move(4,90);
        await rows.nth(index).scrollIntoViewIfNeeded();await rows.nth(index).hover();
        assert.equal(await page.locator('.extra-info-card h3').textContent(),baseline.content[locale].rows[index].title);
        await readyCard();
        if(locale==='ru'&&[0,4,8,13].includes(index))await viewportShot(`desktop-${key}.png`);
        await page.keyboard.press('Escape');assert.equal(await page.locator('.extra-info-card').count(),0);
      }
      assert.equal(imageRequests.size,14);
      await rows.first().scrollIntoViewIfNeeded();await rows.first().hover();await readyCard();
      const rowBox=await rows.first().boundingBox(),cardBox=await page.locator('.extra-info-card').boundingBox();
      await page.mouse.move((rowBox.x+rowBox.width+cardBox.x)/2,rowBox.y+rowBox.height/2);
      await page.waitForTimeout(300);
      assert.equal(await page.locator('.extra-info-card').count(),1,'Slow movement across the gap must not dismiss the card');
      await page.locator('.extra-info-card').hover();await page.waitForTimeout(250);
      assert.equal(await page.locator('.extra-info-card').count(),1);
      await page.mouse.move(4,90);await page.waitForFunction(()=>!document.querySelector('.extra-info-card'));
      // Focus opens the same information. Escape and the close control restore focus.
      await page.keyboard.press('Tab');await rows.first().focus();await readyCard();
      assert.equal(await page.locator('.extra-info-card').evaluate(el=>el.parentElement.dataset.extra),'standardWindow');
      await page.keyboard.press('Tab');
      assert.ok(await page.locator('.extra-info-close').evaluate(el=>el===document.activeElement),JSON.stringify(await page.evaluate(()=>({focus:document.activeElement.outerHTML,card:document.querySelector('.extra-info-card')?.parentElement.dataset.extra}))));
      await page.keyboard.press('Escape');assert.ok(await rows.first().evaluate(el=>el===document.activeElement));
      await page.keyboard.press('Enter');await readyCard();
      await page.locator('.extra-info-close').click();assert.ok(await rows.first().evaluate(el=>el===document.activeElement));
      await page.mouse.move(4,90);
      // Rapid transitions must leave one card for the final row, with no stale timer closing it.
      // Keep the rows in one viewport so this measures mouse transitions rather
      // than WebKit's asynchronous compositor scroll between off-screen targets.
      await rows.nth(7).evaluate(el=>el.scrollIntoView({block:'end',behavior:'instant'}));
      for(const index of [2,3,4,5,6,7]){const box=await rows.nth(index).boundingBox();await page.mouse.move(box.x+100,box.y+box.height/2);}
      await readyCard();assert.equal(await page.locator('.extra-info-card h3').textContent(),baseline.content[locale].rows[7].title);
      await page.keyboard.press('Escape');
      // First row near the bottom: use an inline fallback rather than cover the photos.
      await page.mouse.move(4,90);
      await rows.first().evaluate(el=>window.scrollBy({top:el.getBoundingClientRect().top-935,behavior:'instant'}));
      const firstBox=await rows.first().boundingBox();await page.mouse.move(firstBox.x+60,firstBox.y+10);
      const edge=await readyCard();assert.equal(edge.floating,false);
      if(locale==='ru')await viewportShot('desktop-bottom-edge-fallback.png');
      await page.keyboard.press('Escape');
      for(const width of [1440,1024,768,390,320]){
        report.currentCase={locale,width,mode:'matrix'};
        await page.mouse.move(4,90);await page.setViewportSize({width,height:1000});
        const overflowing=await rows.evaluateAll(els=>els.filter(el=>el.querySelector('strong').scrollWidth>el.querySelector('strong').clientWidth+1).map(el=>el.querySelector('strong').textContent));
        assert.deepEqual(overflowing,[],`${locale}/${width}: a service title overlaps its price`);
        await rows.last().scrollIntoViewIfNeeded();await rows.last().click();await readyCard();
        if([1024,768,320].includes(width))await viewportShot(`${locale}-${width}-linen.png`);
        await page.locator('.extra-info-close').click();
        assert.ok(await rows.last().evaluate(el=>el===document.activeElement));
        report.matrix.push({locale,width,height:1000,status:'PASS'});
      }
      await page.setViewportSize({width:390,height:1000});
      for(const [index,key] of keys.entries()){
        report.currentCase={locale,key,mode:'mobile'};
        await rows.nth(index).click();await readyCard();
        assert.equal(await page.locator('.extra-info-card h3').textContent(),baseline.content[locale].rows[index].title);
        if(locale==='ru'&&[1,6,11,13].includes(index))await viewportShot(`mobile-${key}.png`);
        await rows.nth(index).click();assert.equal(await page.locator('.extra-info-card').count(),0);
      }
      await rows.first().click();await readyCard();
      await page.locator('#faq h2').click();assert.equal(await page.locator('.extra-info-card').count(),0);
      await page.setViewportSize({width:1440,height:1000});await shot(`after-${locale}-1440.png`);
      await page.setViewportSize({width:390,height:1000});await shot(`after-${locale}-390.png`);
      report.scenarios.push({locale,all14DesktopAndMobile:true,keyboard:true,rapidSwitch:true,edges:true,outsideClose:true});
      console.log(`PASS ${locale}: all 14 desktop/mobile, five widths, keyboard, edges and rapid switching`);
    }
    await page.keyboard.press('Escape');await page.mouse.move(4,90);
    await page.emulateMedia({reducedMotion:'reduce'});await page.locator('.extra-ledger-trigger').first().click();await readyCard();
    assert.equal(await page.locator('.extra-info-card').evaluate(el=>getComputedStyle(el).animationName),'none');
    await page.locator('.extra-info-close').click();
    const touch=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    await touch.route('**/*',mockRoute);await touch.addInitScript(()=>localStorage.setItem('lc-analytics-consent-v2','no'));
    const p=await touch.newPage();await p.goto(base+'/sr');
    const trigger=p.locator('.extra-ledger-trigger').last();
    await trigger.tap();await readyCard(p);await trigger.tap();assert.equal(await p.locator('.extra-info-card').count(),0);
    await trigger.tap();await p.locator('.extra-info-close').tap();assert.ok(await trigger.evaluate(el=>el===document.activeElement));
    await p.setViewportSize({width:1440,height:1000});await trigger.tap();const touchGeometry=await readyCard(p);assert.equal(touchGeometry.floating,false);
    await touch.close();report.scenarios.push({touch:true,repeatedTap:true,wideTouchInline:true,reducedMotion:true});
  }
  assert.deepEqual(report.errors,[]);
}catch(error){
  report.failure=error.stack;
  report.debug=await page.evaluate(()=>({focus:document.activeElement.outerHTML,focusVisible:document.activeElement.matches(':focus-visible'),first:document.querySelector('.extra-ledger-trigger').getBoundingClientRect().toJSON(),expanded:[...document.querySelectorAll('.extra-ledger-trigger[aria-expanded="true"]')].map(el=>el.id),card:document.querySelector('.extra-info-card')?.outerHTML,floating:matchMedia('(min-width: 1000px) and (hover: hover) and (pointer: fine)').matches}));
  console.log(report.debug);await page.screenshot({path:path.join(output,'failure.png')});throw error;
}finally{await writeFile(path.join(output,`${before?'before':'after'}.json`),JSON.stringify(report,null,2));await browser.close();}
