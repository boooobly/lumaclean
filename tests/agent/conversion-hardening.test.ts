import assert from 'node:assert/strict';
import test from 'node:test';
import {explicitCustomerFacts,applyCustomerFacts,supportedFacts} from '../../src/lib/agent/customer-facts';
import {bookingReviewBlocked,windowQuantitiesMissing} from '../../src/lib/agent/conversion-facts';
import {nextQualification,quoteText,phoneOffer,conversionIntake} from '../../src/lib/agent/conversion-intake';
import {inputAlreadyKnown,createReplySet} from '../../src/lib/agent/chat-presentation';
import {quote} from '../../src/lib/domain/crm-pricing';
import {mandatoryHandoff,outputAllowed} from '../../src/lib/agent/policy';
import type {AgentState} from '../../src/lib/agent/contracts';
const at=new Date('2026-10-07T06:28:35Z'),zone='Europe/Belgrade';
export const incident='Dobar dan, treba mi generalno čišćenje stana od 57 kvadrata, ukoliko je moguce ovog vikenda, pranje prozora, roletni, jedno kupatilo, tepisi ce biti na pranju. Pozdrav mogućnosti da budu dve osobe da bi kraće trajalo. Da li je to moguce kod vas i koja bi bila cena';
function turn(s:AgentState,text:string,intent?:AgentState['nextInput']){applyCustomerFacts(s,explicitCustomerFacts(text,at,zone,intent,s));}
for(const text of ['Treba mi generalno čišćenje 57 kvadrata','generalno ciscenje','Generalka za 60m2','генерално чишћење','detaljno čišćenje stana'])test('general service: '+text,()=>assert.equal(explicitCustomerFacts(text,at,zone).service,'deep'));
for(const text of ['Vrv redovno, ne znam šta generalno uključuje','Vrv redovno, ne znam sta vam je dubinsko tačno, al ne treba čišćenje kreveta i tepiha','Možda redovno','Mislim redovno','Valjda redovno','Nisam sigurna, redovno','What does deep cleaning include?','Наверное поддерживающая, что значит генеральная?'])test('uncertain service never overwrites: '+text,()=>{
  const s:AgentState={draftFacts:{service:'deep'}};turn(s,text);assert.equal(s.draftFacts?.service,'deep');assert(s.draftFacts?.serviceConfirmationRequired);assert.equal(nextQualification(s),'SERVICE_CONFIRMATION');
  assert(!supportedFacts({service:'regular'},explicitCustomerFacts(text,at,zone)));
});
for(const text of ['Želim održavajuće','Ipak redovno','Ne generalno, nego redovno'])test('explicit correction: '+text,()=>{const s:AgentState={draftFacts:{service:'deep',serviceConfirmationRequired:true}};turn(s,text);assert.equal(s.draftFacts?.service,'regular');assert(!s.draftFacts?.serviceConfirmationRequired);});
test('partial refusal and generic refusal preserve windows, removing only named appliances',()=>{
  const s:AgentState={};turn(s,incident);turn(s,'Nisu, samo spolja','EXTRAS');
  assert.deepEqual(s.draftFacts?.declinedExtras,['oven','fridge']);assert(s.draftFacts?.extrasConfirmed);assert(s.draftFacts?.windowCleaning?.requested);
  turn(s,'5 velikih i dva mala','WINDOW_COUNTS');turn(s,'Bez dodatnih usluga');assert.deepEqual(s.draftFacts?.extras,[{code:'standardWindow',quantity:2},{code:'largeWindow',quantity:5}]);
  turn(s,'Bez dodatnih usluga, ali prozori ostaju');assert.equal(s.draftFacts?.extras?.length,2);
  turn(s,'bez prozora');assert.equal(s.draftFacts?.windowCleaning?.requested,false);assert.deepEqual(s.draftFacts?.extras,[]);
});
for(const [text,large,small] of [['5 velikih i 2 mala',5,2],['pet velikih i dva mala',5,2],['5 velikih prozora, 2 standardna',5,2],['3 velika',3,undefined],['2 mala',undefined,2],['5 больших и 2 маленьких окна',5,2],['5 large and 2 small windows',5,2]] as const)test('window extraction: '+text,()=>{
  const s:AgentState={draftFacts:{windowCleaning:{requested:true}}};turn(s,text,'WINDOW_COUNTS');assert.equal(s.draftFacts?.windowCleaning?.largeCount,large);assert.equal(s.draftFacts?.windowCleaning?.standardCount,small);assert(!windowQuantitiesMissing(s.draftFacts));
});
test('total count requires type; word-only type uses known quantity; unknown quantities stay unknown',()=>{
  const s:AgentState={};turn(s,'7 prozora');assert(windowQuantitiesMissing(s.draftFacts));assert.equal(s.draftFacts?.windowCleaning?.totalCount,7);
  turn(s,'standardni','WINDOW_TYPE');assert.equal(s.draftFacts?.windowCleaning?.standardCount,7);assert(!windowQuantitiesMissing(s.draftFacts));
  const other:AgentState={};turn(other,'7 окон');turn(other,'панорамные','WINDOW_TYPE');assert.equal(other.draftFacts?.windowCleaning?.largeCount,7);
  assert.equal(explicitCustomerFacts('nekoliko prozora',at,zone).windowCleaning?.standardCount,undefined);
});
test('exact incident fact replay preserves intake and deterministic quote path',()=>{
  const s:AgentState={};turn(s,incident);
  assert.equal(s.draftFacts?.service,'deep');assert.equal(s.draftFacts?.area,57);assert(s.draftFacts?.windowCleaning?.requested);assert.deepEqual(s.draftFacts?.reviewItems,['roletne']);assert.equal(s.draftFacts?.bathroomCount,1);assert(s.draftFacts?.carpetsAbsent);assert.equal(s.draftFacts?.requestedCrew,2);assert.deepEqual(s.draftFacts?.requestedWeekend,{saturday:'2026-10-10',sunday:'2026-10-11'});
  turn(s,'Lokacija je bgd, banovo brdo');assert.equal(s.draftFacts?.city,'Belgrade');assert.equal(s.draftFacts?.neighborhoodHint,'Banovo brdo');assert(!s.address);
  turn(s,'Nisu, samo spolja','EXTRAS');turn(s,'Uobičajena zaprljanost');assert.equal(nextQualification(s),'WINDOW_COUNTS');
  turn(s,'Vrv redovno, ne znam sta vam je dubinsko tačno, al ne treba čišćenje kreveta i tepiha');assert.equal(s.draftFacts?.service,'deep');assert.equal(nextQualification(s),'SERVICE_CONFIRMATION');
  const choices=createReplySet({...s,nextInput:'SERVICE_CONFIRMATION'},'sr-Latn',1,'AI_CONTROL')!;assert.equal(choices.choices.length,2);assert(choices.choices[0].label.startsWith('Generalno'));
  turn(s,'Generalno','SERVICE_CONFIRMATION');turn(s,'Nije selidba i nije krečenje, uobičajeno jesenje');turn(s,'Bez dodatnih usluga');turn(s,'5 velikih i dva mala','WINDOW_COUNTS');
  for(const intent of ['EXTRAS','SERVICE_TYPE','AREA','SOIL_LEVEL'])assert(inputAlreadyKnown(intent,s));
  assert.equal(nextQualification(s),undefined);assert(bookingReviewBlocked(s));
  const general=quote('deep',57,s.draftFacts!.extras!,false),regular=quote('regular',57,s.draftFacts!.extras!,false);
  assert.equal(general.total,18500);assert.equal(regular.total,12400);assert.equal(general.extras.reduce((sum,e)=>sum+e.quantity*e.unitPrice,0),7800);
  s.quote={id:'q',serviceId:'s',input:{service:'deep',area:57,extras:s.draftFacts!.extras!,soilLevel:'NORMAL',urgent:false},total:general.total,base:general.base,discountPercent:0,requiresHumanReview:true,at:at.toISOString(),breakdown:general.extras.map(e=>({...e,amount:e.quantity*e.unitPrice}))};
  const text=quoteText(s,'sr-Latn');assert(text.includes('18.500'));assert(text.includes('6.000'));assert(text.includes('1.800'));assert(text.includes('Roletne'));assert(outputAllowed(text,s));
  turn(s,'Možete li SMS-om?');assert.equal(s.preferredContactChannel,'SMS');assert(phoneOffer('Da vam pošaljem broj tel'));
  turn(s,'+381 60 123-4567');assert.equal(s.phone,'+381601234567');assert(bookingReviewBlocked(s));
});
test('phone national forms use existing normalization, without verification',()=>{
  for(const text of ['+381601234567','060 123 4567','060-123-4567']){const s:AgentState={};turn(s,text);assert.equal(s.phone,'+381601234567');assert(!('identityVerified' in s));}
});
test('hard safety reasons remain mandatory',()=>{
  assert.equal(mandatoryHandoff('There are needles and blood'),'HAZARDOUS_CLEANING');assert.equal(mandatoryHandoff('Your cleaner damaged the table'),'COMPLAINT');assert.equal(mandatoryHandoff('I want to speak with a human'),'CLIENT_REQUEST');
});
test('an unrelated location does not repeat an unanswered extras question',async()=>{
  const s:AgentState={draftFacts:{service:'deep',area:57},nextInput:'EXTRAS'};
  turn(s,'Lokacija je bgd, banovo brdo');
  const reply=await conversionIntake(()=>s,'Lokacija je bgd, banovo brdo','sr-Latn',async()=>assert.fail('Do not ask the same qualification question again'),'EXTRAS');
  assert.equal(s.nextInput,'EXTRAS');assert.equal(s.draftFacts?.neighborhoodHint,'Banovo brdo');assert(reply?.includes('Zabeleženo'));assert(!reply?.includes('?'));
  turn(s,'Nisu, samo spolja',s.nextInput);assert(s.draftFacts?.extrasConfirmed);assert.equal(nextQualification(s),'SOIL_LEVEL');
});
