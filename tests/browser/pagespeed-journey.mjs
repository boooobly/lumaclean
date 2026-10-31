import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const base=process.env.BASE_URL||'http://127.0.0.1:3118';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const out='artifacts/pagespeed-2026-10-31/journey';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={mocked:true,scenarios:[],errors:[]};
try{
 for(const width of [375,1440]){
  const context=await browser.newContext({viewport:{width,height:1000}});
  await context.route('**/*',r=>{
   const q=r.request(),u=new URL(q.url());
   if(u.origin!==base)return r.fulfill({status:204});
   if(u.pathname.startsWith('/api/'))return r.fulfill({json:u.pathname==='/api/chat'?{conversation:null}:{allowed:true}});
   assert.ok(['GET','HEAD'].includes(q.method()));return r.continue();
  });
  const page=await context.newPage();
  page.on('pageerror',e=>report.errors.push(e.message));
  const requests=[];page.on('request',r=>requests.push(r.url()));
  await page.goto(base+'/ru');await page.waitForLoadState('networkidle');
  assert.equal(requests.some(u=>/032-(desktop|mobile)/.test(u)),false,'Do not download the distant final frame at entry');
  const hero=page.getByRole('button',{name:'Показать комнату до уборки',exact:true});
  await hero.focus();await page.keyboard.down('Space');
  await page.locator('.journey-dirty').waitFor();assert.equal(await hero.evaluate(el=>el.classList.contains('is-before')),true);
  await page.keyboard.up('Space');assert.equal(await hero.evaluate(el=>el.classList.contains('is-before')),false);
  await page.keyboard.down('Enter');await hero.evaluate(el=>el.blur());
  assert.equal(await hero.evaluate(el=>el.classList.contains('is-before')),false);await page.keyboard.up('Enter');
  report.scenarios.push({width,scenario:'keyboard before/after and blur recovery',status:'PASS'});
  if(width===1440){
   await page.evaluate(()=>{const e=document.querySelector('.journey-track');scrollTo({top:e.offsetTop+(e.offsetHeight-innerHeight)*.8,behavior:'instant'});});
   await page.waitForFunction(()=>{const i=document.querySelector('.journey-final-still img');return i?.complete&&i.naturalWidth>0;});
   await page.evaluate(()=>{const e=document.querySelector('.journey-track');scrollTo({top:e.offsetTop+e.offsetHeight-innerHeight,behavior:'instant'});});
   await page.waitForFunction(()=>document.querySelector('.journey-track').classList.contains('is-final-still'));
   assert.ok(requests.some(u=>u.includes('032-desktop.webp')));assert.ok(requests.some(u=>/desktop\/03.mp4/.test(u)));
   await page.screenshot({path:`${out}/final-desktop.png`});
   await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
   await page.waitForFunction(()=>!document.querySelector('.journey-track').classList.contains('journey-started'));
   report.scenarios.push({width,scenario:'scroll video, final frame loading and reverse to hero',status:'PASS'});
   await page.locator('#rates').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>getComputedStyle(document.querySelector('.site-header nav a')).color==='rgb(16, 37, 43)');
   await page.waitForFunction(()=>!document.getAnimations().some(a=>a.playState==='running'&&a.effect?.target?.closest?.('.site-header')));
   assert.equal(await page.locator('.site-header').evaluate(el=>getComputedStyle(el).color),'rgb(16, 37, 43)');
   assert.equal(await page.locator('.site-header nav a').first().evaluate(el=>getComputedStyle(el).color),'rgb(16, 37, 43)');
   await page.screenshot({path:`${out}/rates-header-settled.png`});
   report.scenarios.push({width,scenario:'settled paper header contrast after scrolling',status:'PASS'});
  }
  await context.close();
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}finally{await writeFile(`${out}/report.json`,JSON.stringify(report,null,2));await browser.close();}
