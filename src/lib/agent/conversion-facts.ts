import type {AgentState} from './contracts';
import {normalizedPhone} from '@/lib/domain/crm';
import {resolveCustomerWeekend} from './temporal';

type Facts=NonNullable<AgentState['draftFacts']>;
export const plain=(text:string)=>text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase();
const uncertain=/\b(?:vrv|verovatno|mozda|mislim|valjda|probably|maybe|perhaps|i think|not sure|nisam sigur(?:an|na))\b|не уверен|наверно|возможно|думаю/iu;
const explanation=/ne znam (?:sta|sto)|sta (?:je|vam je|tacno znaci|podrazumeva)|koja je razlika|what (?:is|does)|what.*include|difference|не знаю|что (?:значит|такое|входит)|разниц/iu;
export function serviceNeedsConfirmation(text:string){
  const t=plain(text);
  return /general|redovno|odrzava|dubinsk|deep|regular|генераль|поддержива|уборк|генерал|дубинск/iu.test(t)&&(uncertain.test(t)||explanation.test(t));
}
const numbers:Record<string,number>={jedan:1,jedna:1,jedno:1,dva:2,dve:2,tri:3,cetiri:4,pet:5,sest:6,sedam:7,osam:8,devet:9,deset:10,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,один:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,семь:7};
const number='(?:[0-9]{1,3}|'+Object.keys(numbers).join('|')+')';
function count(value:string){return /^\d+$/u.test(value)?Number(value):numbers[value];}
const large='(?:velik[a-z]*|panoramsk[a-z]*|large|big|panoramic|больш[а-я]*|панорамн[а-я]*|велик[а-я]*)';
const standard='(?:mal[a-z]*|standard[a-z]*|small|standard|маленьк[а-я]*|мал[а-я]*|стандартн[а-я]*)';
const windowWord=/prozor|прозор|окн|окон|window/iu;
export function conversionFacts(text:string,at:Date,timezone:string,expected?:AgentState['nextInput'],state?:AgentState):Facts {
  const t=plain(text),f:Facts={};
  if(serviceNeedsConfirmation(text))f.serviceConfirmationRequired=true;
  const weekend=resolveCustomerWeekend(text,at,timezone);if(weekend)f.requestedWeekend=weekend;
  if(/\bbgd\b|beograd|belgrade|белград|београд/iu.test(t))f.city='Belgrade';
  if(/banovo brdo|баново брдо/iu.test(t)){f.city='Belgrade';f.neighborhoodHint='Banovo brdo';}
  if(/roletn|ролетн|roller shutters|window shutters|рольстав/iu.test(t)&&!/bez rolet|ne treba.*rolet|without.*shutter|без.*рольстав/iu.test(t))f.reviewItems=['roletne'];
  if(/(?:tepisi|теписи|ковр[а-я]*|carpets?).{0,35}(?:na pranju|nece biti|неће бити|отсутств|не будет|будут на|away|absent|not be)|не (?:треба|нужно).{0,25}(?:tepi|тепи|ковр)|(?:don't|do not) need.{0,25}carpet/iu.test(t))f.carpetsAbsent=true;
  const crew=t.match(new RegExp('('+number+')\\s*(?:osob[a-z]*|cleaners?|people|клинер[а-я]*|человек|особ[а-я]*)','iu'));
  if(crew){const n=count(crew[1]);if(n>=1&&n<=10)f.requestedCrew=n;}
  const bath=t.match(new RegExp('('+number+')\\s*(?:kupatil[a-z]*|bathrooms?|сануз[а-я]*|купатил[а-я]*)','iu'));
  if(bath){const n=count(bath[1]);if(n>=0&&n<=20)f.bathroomCount=n;}
  if(/\bsms\b|смс/iu.test(t)&&!/bez sms|ne (?:zelim|treba).*sms|no sms|don't want.*sms|не (?:надо|нужно).*смс|sms nije potreban/iu.test(t))f.preferredContactChannel='SMS';
  else if(/(?:reply|respond|odgovor|ответ).{0,25}whatsapp/iu.test(t))f.preferredContactChannel='WHATSAPP';
  else if(/(?:reply|respond|odgovor|ответ).{0,25}telegram/iu.test(t))f.preferredContactChannel='TELEGRAM';
  else if(/(?:call me|pozovite|позвоните)/iu.test(t))f.preferredContactChannel='PHONE';
  else if(/(?:reply here|odgovorite ovde|ответьте здесь)/iu.test(t))f.preferredContactChannel='CURRENT_CHAT';
  const phone=text.trim().replace(/^(?:telefon|tel|phone|телефон)\s*[:=]?\s*/iu,'');
  if(/^[+0][\d\s()-]{6,30}$/u.test(phone)){const normalized=normalizedPhone(phone);if(normalized)f.phone=normalized;}
  const windowContext=windowWord.test(t)||expected==='WINDOW_COUNTS'||expected==='WINDOW_TYPE'||!!state?.draftFacts?.windowCleaning?.requested;
  if(/bez prozor|prozore necemo|ne treba.{0,20}(?:pranje )?prozor|without windows|no window cleaning|без окон|окна не (?:нужны|надо)|не нужно.{0,15}мыть окна/iu.test(t)) {
    f.windowCleaning={requested:false};f.declinedExtras=['standardWindow','largeWindow'];
  }else if(windowContext){
    const lc=t.match(new RegExp('('+number+')\\s*'+large,'iu')),sc=t.match(new RegExp('('+number+')\\s*'+standard,'iu'));
    const total=t.match(new RegExp('('+number+')\\s*(?:prozor[a-z]*|windows?|окон|окна|прозор[а-я]*)','iu'));
    if(lc||sc){
      const l=lc?count(lc[1]):undefined,s=sc?count(sc[1]):undefined;
      if((l===undefined||l<=100)&&(s===undefined||s<=100))f.windowCleaning={requested:true,...(l!==undefined?{largeCount:l}:{}),...(s!==undefined?{standardCount:s}:{})};
    }else if(total&&count(total[1])>=1&&count(total[1])<=100)f.windowCleaning={requested:true,totalCount:count(total[1])};
    else if(state?.draftFacts?.windowCleaning?.totalCount&&expected==='WINDOW_TYPE'&&new RegExp('^'+large+'[.!\\s]*$','iu').test(t))f.windowCleaning={requested:true,largeCount:state.draftFacts.windowCleaning.totalCount,standardCount:0};
    else if(state?.draftFacts?.windowCleaning?.totalCount&&expected==='WINDOW_TYPE'&&new RegExp('^'+standard+'[.!\\s]*$','iu').test(t))f.windowCleaning={requested:true,standardCount:state.draftFacts.windowCleaning.totalCount,largeCount:0};
    else if(windowWord.test(t)&&!/ne treba|don't need|do not need|не нужно/iu.test(t))f.windowCleaning={requested:true};
  }
  if(expected==='EXTRAS'&&/^(?:nisu[,! ]*samo spolja|samo spolja|no[,! ]*only outside|only outside|нет[,! ]*только снаружи|только снаружи)[.!\s]*$/iu.test(t)){
    f.declinedExtras=['oven','fridge'];f.extrasConfirmed=true;
  }
  return f;
}
export function windowQuantitiesMissing(f:Facts|undefined){
  const w=f?.windowCleaning;
  return !!w?.requested&&(w.totalCount!==undefined||w.standardCount===undefined&&w.largeCount===undefined);
}
export function bookingReviewBlocked(state:AgentState){
  return !!state.review?.reasons.some(r=>r!=='CONTACT_PREFERENCE')||!!state.draftFacts?.reviewItems?.length||!!state.draftFacts?.serviceConfirmationRequired||windowQuantitiesMissing(state.draftFacts);
}
