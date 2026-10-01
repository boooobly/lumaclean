import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const base=process.env.AI_TEST_BASE_URL;
test('public chat and Inbox HTTP security',{skip:!base},async t=>{
  assert.equal(base,'http://localhost:3101');
  const verifier=JSON.parse(readFileSync('artifacts/admin/ai-local-owner.json','utf8'));
  const post=(path:string,payload:unknown,cookie='',origin=base!)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(payload)});
  const login=await post('/api/auth/sign-in/email',{email:verifier.email,password:verifier.password});assert.equal(login.status,200);
  const adminCookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
  assert.equal((await post('/api/admin/inbox',{action:'mode',mode:'OFF'},adminCookie)).status,200);
  let cookie='',conversationId='',messageId='';
  try{
    await t.test('cross-origin public writes are forbidden',async()=>{assert.equal((await post('/api/chat',{action:'start',locale:'ru'},'','https://attacker.example')).status,403);});
    await t.test('anonymous start sets scoped HttpOnly cookie and no conversation ID',async()=>{const r=await post('/api/chat',{action:'start',locale:'ru'});assert.equal(r.status,200);const set=r.headers.get('set-cookie')!;assert.match(set,/HttpOnly/i);assert.match(set,/Path=\/api\/chat/);assert.match(set,/SameSite=lax/i);cookie=set.split(';')[0];const b=await r.json();assert.equal(b.conversation.messages.length,0);assert.equal(b.conversation.id,undefined);});
    await t.test('anonymous reload reads only its cookie-bound history',async()=>{messageId=crypto.randomUUID();const r=await post('/api/chat',{action:'message',id:messageId,text:'HTTP synthetic cleaning inquiry',locale:'en'},cookie);assert.equal(r.status,200);const get=await fetch(base+'/api/chat',{headers:{Cookie:cookie}});assert.equal((await get.json()).conversation.messages[0].text,'HTTP synthetic cleaning inquiry');const stranger=await fetch(base+'/api/chat');assert.equal((await stranger.json()).conversation,null);});
    await t.test('random token cannot submit to an existing conversation',async()=>{assert.equal((await post('/api/chat',{action:'message',id:crypto.randomUUID(),text:'Hello',locale:'en'},'luma_conversation='+'0'.repeat(64))).status,401);});
    await t.test('arbitrary conversation ID and tools are rejected at ingress',async()=>{assert.equal((await post('/api/chat',{action:'message',id:crypto.randomUUID(),text:'Hello',locale:'en',conversationId:'foreign'},cookie)).status,400);assert.equal((await post('/api/chat',{action:'createOrder',price:1},cookie)).status,400);});
    await t.test('oversized public message has a validation response',async()=>{assert.equal((await post('/api/chat',{action:'message',id:crypto.randomUUID(),text:'x'.repeat(1501),locale:'ru'},cookie)).status,400);});
    await t.test('retry of the same message ID is delivered once',async()=>{const r=await post('/api/chat',{action:'message',id:messageId,text:'HTTP synthetic cleaning inquiry',locale:'en'},cookie);assert.equal(r.status,200);assert.equal((await r.json()).conversation.messages.length,1);});
    await t.test('Inbox requires owner login and recover requires bearer secret',async()=>{assert.equal((await post('/api/admin/inbox',{action:'takeover',id:'foreign'})).status,401);assert.equal((await fetch(base+'/api/agent/recover')).status,401);});
    await t.test('no generic tool endpoint or implicit customer Telegram bot exists',async()=>{assert.equal((await post('/api/agent/tools/createOrder',{})).status,404);assert.equal((await post('/api/channels/telegram',{update_id:1})).status,503);});
    await t.test('public per-conversation rate limit rejects excess messages',async()=>{let limited=false;for(let i=0;i<9;i++){const r=await post('/api/chat',{action:'message',id:crypto.randomUUID(),text:'Synthetic follow-up '+i,locale:'en'},cookie);if(r.status===429){limited=true;break;}assert.equal(r.status,200);}assert(limited);});
    await t.test('owner takeover and manual reply appear through the Website adapter',async()=>{const page=await fetch(base+'/admin/messages',{headers:{Cookie:adminCookie}});assert.equal(page.status,200);const html=await page.text();const escaped=html.match(/href="\/admin\/messages\/([a-z0-9]+)"[^>]*>[\s\S]*?HTTP synthetic cleaning inquiry/);const matches=[...html.matchAll(/href="\/admin\/messages\/([a-z0-9]+)"/g)];assert(matches.length);conversationId=escaped?.[1]??matches[0][1];assert.equal((await post('/api/admin/inbox',{action:'takeover',id:conversationId},adminCookie)).status,200);const input={action:'reply',id:conversationId,requestId:crypto.randomUUID(),text:'HTTP synthetic owner reply'};assert.equal((await post('/api/admin/inbox',input,adminCookie)).status,200);assert.equal((await post('/api/admin/inbox',input,adminCookie)).status,200);const messages=(await (await fetch(base+'/api/chat',{headers:{Cookie:cookie}})).json()).conversation.messages;assert.equal(messages.filter((m:{text:string})=>m.text===input.text).length,1);});
  }finally{await post('/api/admin/inbox',{action:'mode',mode:'SHADOW'},adminCookie);}
});
