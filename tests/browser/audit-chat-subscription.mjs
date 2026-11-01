import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const base=process.env.BASE_URL||'http://localhost:3100';
assert.ok(['localhost','127.0.0.1'].includes(new URL(base).hostname)||base==='https://lumacleanrs.com');
const browser=await chromium.launch({channel:'chrome',headless:true});
const report={base,mocked:true,localFix:new URL(base).hostname!=='lumacleanrs.com',cases:[]};
try {
 for(const locale of ['ru','sr','en']) {
  const context=await browser.newContext({viewport:{width:375,height:900}}),page=await context.newPage();
  let streams=0,gets=0,sequence=0;
  const chat=()=>({displayAlias:'Synthetic',locale:locale==='sr'?'sr-Latn':locale,revision:sequence,typing:false,quickReplies:null,messages:sequence?[{id:'operator-reply',author:'ADMIN',text:'Synthetic reply after reconnect',sentAt:new Date().toISOString(),attachments:[]}]:[],control:sequence?'HUMAN_CONTROL':'AI_CONTROL',pending:false,confirmation:null,booking:null});
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url());
   if(u.pathname==='/api/chat/events'){streams++;return route.fulfill({contentType:'text/event-stream',body:`retry: 30000\nevent: message\ndata: ${JSON.stringify({conversation:chat()})}\n\n`});}
   if(u.pathname==='/api/chat'){gets++;return route.fulfill({json:{conversation:chat()}});}
   if(u.pathname.startsWith('/api/'))return route.fulfill({json:{allowed:true}});
   if(u.origin!==base)return route.fulfill({status:204});
   assert.ok(['GET','HEAD'].includes(r.method()));return route.continue();
  });
  await page.goto(base+'/'+locale);await page.waitForLoadState('networkidle');
  const initiallyClosed=streams;
  if(report.localFix)assert.equal(initiallyClosed,0,'Closed widget must not create SSE');
  const streamed=page.waitForResponse('**/api/chat/events',{timeout:5000}).catch(()=>null);
  await page.locator('.website-chat-launcher').click();
  await streamed;
  const opened=streams;assert.ok(opened>0);
  // A hidden tab must disconnect; reopening must fetch history and human control.
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
  const beforeResume=gets;sequence=1;
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
  await page.getByText('Synthetic reply after reconnect',{exact:true}).waitFor();
  if(report.localFix)assert.ok(gets>beforeResume);
  report.cases.push({locale,initiallyClosed,opened,resumeGets:gets-beforeResume,replyRestored:true});
  await context.close();
 }
} finally {
 await browser.close();await mkdir('artifacts/audit-20261101',{recursive:true});
 await writeFile(`artifacts/audit-20261101/chat-${report.localFix?'after':'before'}.json`,JSON.stringify(report,null,2));
}
console.log(JSON.stringify(report));
