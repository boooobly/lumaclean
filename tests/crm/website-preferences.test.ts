import test from 'node:test';
import assert from 'node:assert/strict';
import {websiteLeadSchema} from '../../src/lib/validation/crm';
import {websiteDatePolicy} from '../../src/lib/domain/website-preferences';
import {websiteLeadNotificationText} from '../../src/lib/services/lead-notifications';
import {safeEventData,eventNames} from '../../src/lib/analytics';
import {calculatePrice} from '../../src/lib/pricing';

const payload={submissionId:'00000000-0000-4000-8000-000000000001',phone:'+381601234567',locale:'ru',service:'regular',area:55,consent:true};
const settings={timezone:'Europe/Belgrade',sameDayBookingCutoffMinute:1020};
test('name is optional and absence is never replaced with a fictional name',()=>{
  assert.equal(websiteLeadSchema.parse(payload).name,null);
  assert.equal(websiteLeadSchema.parse({...payload,name:'  '}).name,null);
  assert.equal(websiteLeadSchema.parse({...payload,name:'А'}).name,'А');
  assert(!websiteLeadSchema.safeParse({...payload,name:'x'.repeat(101)}).success);
  assert(!websiteLeadSchema.safeParse({...payload,consent:false}).success);
});
test('preferences use bounded, typed fields rather than scheduling or free text',()=>{
  const input=websiteLeadSchema.parse({...payload,preferredDate:'2026-10-25',preferredTime:'MORNING',preferredChannel:'WHATSAPP'});
  assert.equal(input.preferredDate,'2026-10-25');
  for(const extra of [{preferredDate:'2026-02-30'},{preferredDate:'2026-10-25T10:00:00Z'},{preferredTime:'09:00 confirmed'},{preferredChannel:'EMAIL'},{scheduledStart:'2026-10-25T10:00:00Z'}])assert(!websiteLeadSchema.safeParse({...payload,...extra}).success);
});
test('future date overrides an untrusted urgency flag; no date has no surcharge',()=>{
  const now=new Date('2026-10-18T14:59:00Z');
  assert.deepEqual(websiteDatePolicy({preferredDate:'2026-10-19',urgent:true},settings,now),{urgent:false});
  assert.deepEqual(websiteDatePolicy({urgent:false},settings,now),{urgent:false});
  assert.deepEqual(websiteDatePolicy({preferredDate:'2026-10-18',urgent:false},settings,now),{urgent:true});
});
for(const [instant,today] of [['2026-07-01T22:30:00Z','2026-07-02'],['2026-12-01T23:30:00Z','2026-12-02']])test(`Belgrade calendar date, not browser UTC: ${instant}`,()=>{
  assert.deepEqual(websiteDatePolicy({preferredDate:today,urgent:false},settings,new Date(instant)),{urgent:true});
});
test('17:00 cutoff is checked at persistence time, including exact boundary',()=>{
  assert.equal(websiteDatePolicy({preferredDate:'2026-10-18',urgent:false},settings,new Date('2026-10-18T15:00:00Z')).error,'SAME_DAY_CUTOFF');
  assert.equal(websiteDatePolicy({preferredDate:'2026-10-17',urgent:false},settings,new Date('2026-10-18T10:00:00Z')).error,'PAST_SERVICE_DATE');
});
test('normal prices and new windows use the existing financial function',()=>{
  assert.equal(calculatePrice('regular',55,[],false).total,6000);
  assert.equal(calculatePrice('deep',55,[],false).total,11400);
  assert.equal(calculatePrice('deep',55,[{code:'standardWindow',quantity:2}],false).total,12800);
  assert.equal(calculatePrice('regular',55,[],true).total,7200);
});
test('manager notification includes date preference and missing name, without claiming a booking',()=>{
  const text=websiteLeadNotificationText({id:'test',reference:'TEST',name:null,phone:'+381601234567',requestKind:'CLEANING_UPHOLSTERY',estimatedPrice:6000,preferredDate:new Date('2026-10-25T00:00:00Z'),preferredTime:'MORNING',preferredChannel:'WHATSAPP'});
  assert(text.includes('2026-10-25'));assert(text.includes('Утро'));assert(text.includes('WHATSAPP'));assert(text.includes('не подтверждённая бронь'));assert(text.includes('Имя не указано'));assert(!text.includes('null'));
});
test('conversion analytics cannot transmit contact, dates, comments, address or totals',()=>{
  const dirty={locale:'ru',service:'regular',date_choice:'future',flow_version:'conversion_v1',phone:'+381601234567',name:'Test',comment:'Private',address:'Private',preferredDate:'2026-10-25',total:6000};
  assert.deepEqual(safeEventData(dirty,[]),{locale:'ru',service:'regular',date_choice:'future',flow_version:'conversion_v1'});
  assert.deepEqual(safeEventData({date_choice:'2026-10-25',flow_version:'phone'},[]),{});
  for(const event of ['calculator_open','service_select','price_view','extras_open','preferred_date_select','contact_start','generate_lead','lead_error','messenger_click'])assert((eventNames as readonly string[]).includes(event));
});
