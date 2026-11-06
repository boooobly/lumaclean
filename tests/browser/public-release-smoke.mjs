// Published-site UI smoke. API traffic and external analytics are intercepted;
// this script never submits a real enquiry or sends a messenger message.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {servicePages} from './service-routes.mjs';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const base='https://lumacleanrs.com',output='artifacts/final-review/production';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.addInitScript(()=>localStorage.setItem('lc-analytics-consent-v2','no'));
const report={base,mocked:true,pages:[],matrix:[],extras:[],spot:[],errors:[],blockedWrites:[]};
await context.route('**/*',route=>{
 const request=route.request(),url=new URL(request.url());
 if(!['GET','HEAD'].includes(request.method())){report.blockedWrites.push(url.pathname);return route.abort('blockedbyclient');}
 if(url.origin!==base)return route.fulfill({status:204});
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/chat'?{conversation:null}:{allowed:false}});
 return route.continue();
});
const routes=[...['ru','sr','en'].map(locale=>({locale,id:'home',path:`/${locale}`})),...Object.entries({ru:'himchistka-mebeli',sr:'dubinsko-pranje-namestaja',en:'upholstery-cleaning'}).map(([locale,slug])=>({locale,id:'upholstery',path:`/${locale}/${slug}`})),...servicePages];
let page;
async function capture(file,selector){
 const el=page.locator(selector);await el.scrollIntoViewIfNeeded();
 await page.waitForFunction(s=>[...document.querySelector(s).querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth),selector);
 const hidden=await page.addStyleTag({content:'.site-header,.website-chat-launcher{visibility:hidden!important}'});
 await el.screenshot({path:`${output}/${file}`,animations:'disabled'});await hidden.evaluate(el=>el.remove());
}
try{
 for(const item of routes){
  if(page)await page.close();page=await context.newPage();
  page.on('pageerror',error=>report.errors.push({path:item.path,message:error.message}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({path:item.path,message:message.text()});});
  const response=await page.goto(base+item.path);assert.equal(response.status(),200,item.path);
  await page.evaluate(()=>document.fonts.ready);await page.waitForLoadState('networkidle');
  assert.equal(await page.locator('html').getAttribute('lang'),item.locale);
  assert.equal(await page.locator('h1').count(),1);
  assert.equal(await page.locator('link[rel="canonical"]').getAttribute('href'),base+item.path);
  assert.equal(await page.locator('link[rel="alternate"][hreflang]').count(),4);
  if(servicePages.some(p=>p.path===item.path)){
   assert.ok((await page.locator('h1').textContent()).trim().length>10);
   assert.ok((await page.locator('.service-hero-image img').getAttribute('src')).includes(`%2Fservices%2F${item.id}.webp`));
  }
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:1000});
   await page.evaluate(async()=>{for(const img of document.images)img.loading='eager';await Promise.all([...document.images].map(img=>img.decode().catch(()=>{})));});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${item.path}/${width}`);
   report.matrix.push({path:item.path,width,status:'PASS'});
   if(item.locale==='ru'&&[1440,390].includes(width)){
    if(item.id==='home')for(const [name,selector]of [['scope','#scope'],['estimate','#estimate'],['faq','#faq']])await capture(`home-${width}-${name}.png`,selector);
    else if(item.id==='upholstery'){await capture(`upholstery-${width}-spot.png`,'.up-gallery-4');await capture(`upholstery-${width}-method.png`,'.up-method');}
    else await capture(`${item.id}-${width}-hero.png`,'.service-hero');
   }
  }
  if(item.id==='home'){
   assert.equal(await page.locator('.service-directory a').count(),3);
   assert.equal(await page.locator('.scope-comparison h3 a').count(),2);
   if(item.locale==='ru'){
    await page.setViewportSize({width:1440,height:1000});
    await page.waitForFunction(()=>document.querySelector('.extras-experience')?.dataset.floatingEnabled==='true');
    for(const trigger of await page.locator('.extra-ledger-trigger').all()){
     // A new mouse gesture follows Escape; locator autoscroll alone must not
     // reopen a card under a stationary pointer while keyboard focus is active.
     await page.mouse.move(4,90);await trigger.scrollIntoViewIfNeeded();
     const title=await trigger.locator('strong').textContent();await trigger.hover();await page.locator('.extra-info-card').waitFor();
     await page.waitForFunction(()=>{const img=document.querySelector('.extra-info-card img');return img?.complete&&img.naturalWidth;});
     assert.equal(await page.locator('.extra-info-card h3').textContent(),title);
     assert.ok((await page.locator('.extra-info-close').boundingBox()).width>=44);
     await trigger.press('Escape');report.extras.push({title,status:'PASS'});
    }
   }
  }else if(item.id==='upholstery'){
   await page.locator('.up-gallery-4').click();await page.waitForFunction(()=>document.querySelector('.up-type select')?.value==='SPOT');
   assert.ok((await page.locator('.up-item-thumb img').first().getAttribute('src')).includes('spot-cleaning.webp'));
   report.spot.push({locale:item.locale,status:'PASS'});
  }else{
   const faq=page.locator('.service-faq details').first();await faq.locator('summary').press('Enter');assert.equal(await faq.getAttribute('open'),null);
   await faq.locator('summary').press('Enter');assert.equal(await faq.getAttribute('open'),'');
  }
  report.pages.push({path:item.path,status:response.status()});console.log(`PRODUCTION PASS ${item.path}`);
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.blockedWrites,[]);report.status='PASS';
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
