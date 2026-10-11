import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {websiteLeadSchema} from '../../src/lib/validation/crm';
import {leadRequestKind,upholsteryEnquiryPath,enquiryCopy} from '../../src/lib/lead-intent';
import {websiteLeadNotificationText} from '../../src/lib/services/lead-notifications';
import {sendAdminLeadTelegram} from '../../src/lib/agent/telegram-handoff';
import {upholsteryIntent} from '../../src/lib/upholstery-intent';
const contact={submissionId:randomUUID(),name:'Test client',phone:'+381641234567',locale:'ru',consent:true};
test('existing cleaning contract and calculation fields remain valid',()=>{
 const v=websiteLeadSchema.parse({...contact,service:'deep',area:60,extras:[]});
 assert.equal(v.requestKind,'CLEANING');assert.equal(v.upholsteryRequested,false);assert.equal(v.area,60);
});
test('combined intent preserves cleaning selection without technical qualification',()=>{
 const v=websiteLeadSchema.parse({...contact,service:'deep',area:60,upholsteryRequested:true});
 assert.equal(v.requestKind,'CLEANING_UPHOLSTERY');assert.equal(v.service,'deep');
});
test('upholstery only has no fictional area, price, furniture or cleaning service',()=>{
 const v=websiteLeadSchema.parse({...contact,requestKind:'UPHOLSTERY'});
 assert.equal(v.upholsteryRequested,true);assert.equal(v.area,undefined);assert.equal(v.service,undefined);assert.equal(v.estimate,null);
 for(const more of [{service:'regular'},{area:55},{estimate:'0 RSD'},{urgent:true},{requestKind:'UPHOLSTERY',upholsteryRequested:false},{items:[]}])assert.equal(websiteLeadSchema.safeParse({...contact,requestKind:'UPHOLSTERY',...more}).success,false);
});
test('name, phone, consent validation; comment is optional in every locale',()=>{
 for(const locale of ['ru','sr','en'])assert.equal(websiteLeadSchema.safeParse({...contact,locale,requestKind:'UPHOLSTERY'}).success,true);
 for(const bad of [{name:'A'},{phone:'1'},{consent:false},{consent:undefined},{submissionId:'bad'}])assert.equal(websiteLeadSchema.safeParse({...contact,requestKind:'UPHOLSTERY',...bad}).success,false);
});
test('manager notification distinguishes cleaning subtotal from upholstery pending price',()=>{
 const base={id:'lead-123',reference:'LC-test',name:'Test',phone:contact.phone,comment:null};
 const combined=websiteLeadNotificationText({...base,requestKind:'CLEANING_UPHOLSTERY',service:'deep',area:60,estimatedPrice:8000});
 assert.match(combined,/8000 RSD \(без химчистки\)/);assert.match(combined,/требуется уточнение/);assert.match(combined,/admin\/leads\/lead-123/);
 const only=websiteLeadNotificationText({...base,requestKind:'UPHOLSTERY',estimatedPrice:null});
 assert.match(only,/Только химчистка/);assert.doesNotMatch(only,/0 RSD|null RSD|Уборка:|Расчёт уборки/);
});
test('legacy upholstery lead intent and all localized deep links remain meaningful',()=>{
 assert.equal(leadRequestKind({upholsteryQuote:{input:{mode:'ADDON'}}}),'CLEANING_UPHOLSTERY');
 assert.equal(leadRequestKind({upholsteryQuote:{input:{mode:'STANDALONE'}}}),'UPHOLSTERY');
 for(const locale of ['ru','sr','en'] as const){assert.equal(upholsteryEnquiryPath(locale),`/${locale}?request=upholstery#estimate`);assert(enquiryCopy[locale].checkbox);assert(enquiryCopy[locale].onlyPrice);}
 for(const text of ['Нужна химчистка дивана','Treba mi pranje tepiha','I need carpet cleaning','Can you clean a sofa stain?'])assert(upholsteryIntent(text));
 assert(!upholsteryIntent('Generalno čišćenje stana 60 m2'));
});
test('existing Telegram transport validates delivery, rate limits and ambiguous failure',async()=>{
 const oldToken=process.env.TELEGRAM_BOT_TOKEN,oldChat=process.env.TELEGRAM_CHAT_ID;
 process.env.TELEGRAM_BOT_TOKEN='test-token';process.env.TELEGRAM_CHAT_ID='test-chat';
 try{
  let requests=0;
  const ok=await sendAdminLeadTelegram('Test','lead-123',async(_url,init)=>{requests++;const payload=JSON.parse(String(init?.body));assert.match(payload.reply_markup.inline_keyboard[0][0].url,/admin\/leads\/lead-123/);return new Response(JSON.stringify({ok:true,result:{message_id:123}}),{status:200});});
  assert.equal(ok.status,'DELIVERED');assert.equal(requests,1);
  const rate=await sendAdminLeadTelegram('Test','lead-123',async()=>new Response('{}',{status:429}));assert.equal(rate.errorCode,'TELEGRAM_RATE_LIMIT');
  const unknown=await sendAdminLeadTelegram('Test','lead-123',async()=>new Response('{}',{status:503}));assert.equal(unknown.status,'UNKNOWN');
  const rejected=await sendAdminLeadTelegram('Test','lead-123',async()=>new Response('{"ok":false}',{status:400}));assert.equal(rejected.status,'FAILED');
 }finally{if(oldToken===undefined)delete process.env.TELEGRAM_BOT_TOKEN;else process.env.TELEGRAM_BOT_TOKEN=oldToken;if(oldChat===undefined)delete process.env.TELEGRAM_CHAT_ID;else process.env.TELEGRAM_CHAT_ID=oldChat;}
});
