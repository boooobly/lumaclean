import test from 'node:test';
import assert from 'node:assert/strict';
import { basePrice, calculatePrice, type ServiceId } from '../../src/lib/pricing';
import { quote } from '../../src/lib/domain/crm-pricing';
import { calculateUpholstery, upholsteryDefaults, furnitureSchema } from '../../src/lib/upholstery';
import { websiteLeadSchema } from '../../src/lib/validation/crm';

// Independently transcribed from live project-price columns, 2026-10-17.
const areas = [39,40,59,60,79,80,99,100,120];
const expected: Record<ServiceId, number[]> = {
  regular: [4900,6000,6000,8200,8200,9800,9800,9800,11800],
  deep: [9900,11400,11400,14200,14200,17000,17000,18000,21600],
  move: [10700,12800,12800,15600,15600,18400,18400,18000,21600],
  airbnb: [4900,5800,5800,7400,7400,9000,9000,9000,10800],
  office: [4900,5800,5800,7400,7400,9000,9000,9000,10800],
};
for (const service of Object.keys(expected) as ServiceId[]) for (const [i,area] of areas.entries()) test(`${service} ${area} m² public = CRM`, () => {
  assert.equal(basePrice(service,area),expected[service][i]);
  assert.equal(quote(service,area,[],false).total,expected[service][i]);
});
const extras: [Parameters<typeof calculatePrice>[2],number][] = [
  [[{code:'fridge',quantity:1}],1000], [[{code:'oven',quantity:1}],1400],
  [[{code:'microwave',quantity:1}],700], [[{code:'fridge',quantity:1},{code:'oven',quantity:1}],2400],
  [[{code:'standardWindow',quantity:2}],2000], [[{code:'largeWindow',quantity:1}],1500],
  [[{code:'cabinets',quantity:2}],1000], [[{code:'ironing',quantity:1}],900],
  [[{code:'ironing',quantity:2}],1800], [[{code:'linen',quantity:1}],750],
  [[{code:'balcony',quantity:1}],1200], [[{code:'petHair',quantity:1}],900],
  [[{code:'steam',quantity:1}],2800], [[{code:'hood',quantity:1}],1000],
  [[{code:'dishwasher',quantity:1}],1000], [[{code:'washingMachine',quantity:1}],1000],
];
for (const [lines,amount] of extras) test(`approved extras ${JSON.stringify(lines)}`,()=>{
  assert.equal(calculatePrice('regular',39,lines,false).total,4900+amount);
  assert.deepEqual(quote('regular',39,lines,false),calculatePrice('regular',39,lines,false));
});
for(const [type,amount] of [['SOFA2',4000],['SOFA3',4600],['ARMCHAIR',2200],['CHAIR',600]] as const) test(`upholstery ${type}, no second minimum on addon`,()=>{
  const item = {type,quantity:1,soil:'NORMAL' as const,fabric:'WET_COMPATIBLE' as const,size:'standard',material:'washable',notes:''};
  assert.equal(calculateUpholstery({mode:'ADDON',items:[item],urgent:false},upholsteryDefaults,1).total,amount);
  assert.equal(calculateUpholstery({mode:'STANDALONE',items:[item],urgent:false},upholsteryDefaults,1).total,Math.max(4000,amount));
});
test('corner is whole sofa up to four seats, then 2000 per additional seat',()=>{
  for(const [seats,total] of [[4,5600],[5,7600],[6,9600]]) {
    const q=calculateUpholstery({mode:'STANDALONE',items:[{type:'CORNER',quantity:1,seats,soil:'NORMAL',fabric:'WET_COMPATIBLE',size:'standard',material:'washable',notes:''}],urgent:false},upholsteryDefaults,1);
    assert.equal(q.total,total);assert.equal(q.lines[0].units,1);assert.equal(q.autonomousBooking,false);
  }
});
test('unmapped mattress sides and carpet piles remain manual enquiries',()=>{
  for(const type of ['MATTRESS_SINGLE','MATTRESS_DOUBLE','CARPET_LOW','CARPET_HIGH']) assert.equal(furnitureSchema.safeParse({type,quantity:1,soil:'NORMAL',fabric:'WET_COMPATIBLE'}).success,false);
  const enquiry={submissionId:'00000000-0000-4000-8000-000000000001',name:'Test',phone:'+381601234567',locale:'ru',consent:true,comment:'single mattress one side, double mattress one side; low/high pile carpet'};
  assert(websiteLeadSchema.safeParse({...enquiry,requestKind:'UPHOLSTERY',upholsteryRequested:true}).success);
  assert(websiteLeadSchema.safeParse({...enquiry,requestKind:'CLEANING_UPHOLSTERY',upholsteryRequested:true,service:'regular',area:39}).success);
});

