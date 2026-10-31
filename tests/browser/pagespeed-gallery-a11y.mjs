import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const base=process.env.BASE_URL||'http://127.0.0.1:3118';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname));
const report={mocked:true,checks:[],errors:[]};
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const context=await browser.newContext();
 await context.route('**/*',r=>{
  const q=r.request(),u=new URL(q.url());
  if(u.origin!==base)return r.fulfill({status:204});
  if(u.pathname.startsWith('/api/'))return r.fulfill({json:u.pathname==='/api/chat'?{conversation:null}:{allowed:true}});
  assert.ok(['GET','HEAD'].includes(q.method()));return r.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 for(const route of ['/ru/himchistka-mebeli','/sr/dubinsko-pranje-namestaja','/en/upholstery-cleaning'])for(const width of [375,1440]){
  await page.setViewportSize({width,height:1000});await page.goto(base+route);await page.waitForLoadState('networkidle');
  await page.addScriptTag({path:process.env.AXE_CORE_PATH});
  const result=await page.evaluate(()=>window.axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}));
  const failures=result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}));
  report.checks.push({route,width,failures});assert.deepEqual(failures,[],`${route} ${width}`);
 }
 assert.deepEqual(report.errors,[]);report.status='PASS';
}finally{await mkdir('artifacts/pagespeed-2026-10-31',{recursive:true});await writeFile('artifacts/pagespeed-2026-10-31/gallery-a11y.json',JSON.stringify(report,null,2));await browser.close();}
