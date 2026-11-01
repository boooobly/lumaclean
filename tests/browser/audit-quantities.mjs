// Every external/API request is intercepted. This is UI evidence, not delivery proof.
import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const base=process.env.BASE_URL||'http://localhost:3100';assert.equal(new URL(base).hostname,'localhost');
const browser=await chromium.launch({channel:'chrome',headless:true});const report={scope:'MOCKED transport; RU/SR/EN actual UI',cases:[],errors:[]};
try{
 for(const locale of ['ru','sr','en']){
  const context=await browser.newContext({viewport:{width:locale==='sr'?390:1440,height:1000}}),writes=[];
  await context.route('**/*',async route=>{
   const r=route.request(),url=new URL(r.url());
   if(url.origin!==base)return route.fulfill({status:204});
   if(url.pathname.startsWith('/api/')){
    if(url.pathname==='/api/lead'&&r.method()==='POST'){writes.push(r.postDataJSON());return route.fulfill({contentType:'application/json',body:JSON.stringify({ok:true,reference:'LC-MOCK-QUANTITY'})});}
    assert.equal(r.method(),'GET');return route.fulfill({contentType:'application/json',body:JSON.stringify(url.pathname==='/api/chat'?{ok:true,conversation:null}:{allowed:false})});
   }
   assert(['GET','HEAD'].includes(r.method()));return route.continue();
  });
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(base+'/'+locale);
  const form=page.locator('#estimate'),counter=form.locator('.site-extra-counter').filter({hasText:/кровать|krevet|bed/i});
  const minus=counter.locator('button').first(),plus=counter.locator('button').last();
  await form.locator('.estimate-extras-disclosure > summary').click();
  await counter.waitFor();assert.equal(await counter.locator('b').innerText(),'0');assert.equal(await minus.isEnabled(),false);
  await plus.press('Enter');assert.equal(await counter.locator('b').innerText(),'1');await plus.press('Enter');assert.equal(await counter.locator('b').innerText(),'2');
  for(let i=2;i<100;i++)await plus.press('Enter');assert.equal(await counter.locator('b').innerText(),'100');assert.equal(await plus.isEnabled(),false);
  assert.equal(Number((await form.locator('.receipt-total output').innerText()).replace(/\D/g,'')),81000);
  for(let i=100;i>2;i--)await minus.press('Enter');assert.equal(await counter.locator('b').innerText(),'2');
  await form.locator('[name="name"]').fill('Synthetic quantity test');await form.locator('[name="phone"]').fill('0649999901');await form.locator('.site-consent input').check();await form.locator('button[type="submit"]').click();
  await form.locator('.site-form-status.success').waitFor();assert.equal(writes.length,1);assert.equal(writes[0].extras.find(e=>e.code==='linen').quantity,2);
  report.cases.push({locale,boundaries:[0,1,2,100],over100Disabled:true,quantity:2,total:7500,writesMocked:1});await context.close();
 }
 assert.equal(report.errors.length,0);report.status='PASS';
}finally{await browser.close();writeFileSync('artifacts/audit-20261101/quantities-browser.json',JSON.stringify(report,null,2));}
console.log(JSON.stringify(report));
