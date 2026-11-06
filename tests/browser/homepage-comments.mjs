// Safe visual regression for the four homepage review comments.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const drivers=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const engine=process.env.BROWSER_ENGINE||'chromium';
const base=process.env.BASE_URL||'http://127.0.0.1:3112';
const output=process.env.ARTIFACT_DIR||'artifacts/homepage-comments';
const before=process.argv.includes('--before');
await mkdir(output,{recursive:true});
const browser=await drivers[engine].launch({headless:true,...engine==='chromium'?{channel:'chrome'}:{}});
const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
await context.addInitScript(()=>localStorage.setItem('lc-analytics-consent-v2','no'));
await context.route('**/*',route=>{
 const r=route.request(),url=new URL(r.url());
 if(!['GET','HEAD'].includes(r.method()))return route.abort('blockedbyclient');
 if(url.origin!==base)return route.fulfill({status:204});
 if(url.pathname.startsWith('/api/'))return route.fulfill({json:url.pathname==='/api/chat'?{conversation:null}:{allowed:false}});
 return route.continue();
});
const page=await context.newPage(),report={engine,before,matrix:[],hover:[],errors:[]};
page.on('pageerror',e=>report.errors.push(e.message));
try{
 for(const locale of ['ru','sr','en']){
  await page.goto(base+'/'+locale);await page.evaluate(()=>document.fonts.ready);
  for(const width of [1440,1024,768,390,320]){
   await page.setViewportSize({width,height:1000});
   const geometry=await page.evaluate(()=>{
    const rects=[...document.querySelectorAll('.extra-ledger-trigger')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width};});
    const radii=selector=>{const s=getComputedStyle(document.querySelector(selector));return[s.borderTopLeftRadius,s.borderTopRightRadius,s.borderBottomRightRadius,s.borderBottomLeftRadius].map(parseFloat);};
    return{rects,overflow:document.documentElement.scrollWidth>innerWidth,terms:radii('.evidence-grid figure'),faq:radii('.homepage-faq-image'),chrome:radii('.material-chrome')};
   });
   if(!before){
    assert.equal(geometry.overflow,false,`${locale}/${width}: horizontal overflow`);
    const [first,second]=geometry.rects;
    if(width>=768){assert.ok(second.x>first.x+first.width,`${locale}/${width}: two columns`);assert.ok(Math.abs(second.y-first.y)<1);}
    else assert.ok(Math.abs(second.x-first.x)<1&&second.y>first.y);
    for(const [key,corner] of [['terms',1],['chrome',1],['faq',3]]){
     assert.ok(geometry[key][corner]>=36,`${key}: correct large corner`);
     assert.ok(geometry[key].every((r,i)=>i===corner||r<=3),`${key}: other corners`);
    }
   }
   if(locale==='ru'&&[1440,390].includes(width)){
    for(const [name,selector] of [['extras','.extras-experience'],['photos','.material-stories'],['terms','#terms'],['faq','#faq']]){
     await page.locator(selector).scrollIntoViewIfNeeded();
     await page.waitForFunction(s=>[...document.querySelector(s).querySelectorAll('img')].every(i=>i.complete&&i.naturalWidth),selector);
     const style=await page.addStyleTag({content:'.site-header,.website-chat{visibility:hidden!important}'});
     await page.locator(selector).screenshot({path:`${output}/${before?'before':'after'}-${name}-${width}.png`,animations:'disabled'});
     await style.evaluate(el=>el.remove());
    }
   }
   report.matrix.push({locale,width,status:'PASS'});
  }
  if(!before){
   for(const width of [1440,1024]){
    await page.setViewportSize({width,height:1000});
    const rows=page.locator('.extra-ledger-trigger');
    for(let index=0;index<14;index++){
     await page.mouse.move(1,90);await page.keyboard.press('Escape');
     const row=rows.nth(index),title=await row.locator('strong').textContent();
     await row.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await row.hover();
     await page.waitForFunction(expected=>{
      const card=document.querySelector('.extra-info-card'),img=card?.querySelector('img');
      return card?.querySelector('h3').textContent===expected&&img?.complete&&img.naturalWidth;
     },title);
     await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
     const key=await row.evaluate(el=>el.closest('[data-extra]').dataset.extra);
     const card=page.locator('.extra-info-card');
     const image=await card.locator('img').getAttribute('src');
     assert.ok(decodeURIComponent(image).includes(`/media/extras/${key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}.webp`));
     const bounds=await card.evaluate(el=>{
      const r=el.getBoundingClientRect(),text=el.querySelector('h3').getBoundingClientRect(),close=el.querySelector('button').getBoundingClientRect();
      const overlap=[...document.querySelectorAll('.extra-ledger-trigger')].some(b=>{const a=b.getBoundingClientRect();return r.left<a.right&&r.right>a.left&&r.top<a.bottom&&r.bottom>a.top;});
      return{overlap,left:r.left,right:r.right,top:r.top,bottom:r.bottom,floating:el.dataset.floating,textTop:text.top,closeBottom:close.bottom};
     });
     assert.equal(bounds.overlap,false,`${locale}/${width}/${key}: photo covers a row`);
     assert.ok(bounds.textTop>=bounds.closeBottom+8,`${locale}/${width}/${key}: photo text and close overlap`);
     if(bounds.floating==='true')assert.ok(bounds.left>=16&&bounds.right<=width-15&&bounds.top>=95&&bounds.bottom<=985,`${locale}/${width}/${key}: ${JSON.stringify(bounds)}`);
     if(locale==='ru'&&[0,7,13].includes(index))await page.screenshot({path:`${output}/hover-${width}-${key}.png`,animations:'disabled'});
     report.hover.push({locale,width,key,status:'PASS'});
    }
    await page.keyboard.press('Escape');
   }
   await page.setViewportSize({width:1440,height:1000});
   const first=page.locator('.extra-ledger-trigger').first();
   await page.mouse.move(1,90);await first.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));
   await first.hover();await page.locator('.extra-info-card').waitFor();
   const title=await page.locator('.extra-info-card h3').textContent();
   const source=await first.boundingBox(),target=await page.locator('.extra-info-card').boundingBox();
   await page.mouse.move(source.x+source.width-5,source.y+source.height/2);
   await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:80});
   assert.equal(await page.locator('.extra-info-card h3').textContent(),title,'Crossing the second column to the photo must preserve the first service');
   await page.locator('.extra-info-close').click();
  }
 }
 assert.deepEqual(report.errors,[]);
 console.log(`PASS ${engine}: ${report.matrix.length} localized layouts, four review comments`);
}finally{await writeFile(`${output}/${before?'before':'after'}.json`,JSON.stringify(report,null,2));await browser.close();}
