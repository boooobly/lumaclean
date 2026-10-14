import type {AgentState,ToolName,ToolResult} from './contracts';
import {windowQuantitiesMissing} from './conversion-facts';
import {inputQuestion} from './chat-presentation';
import {formatRsd,calculatePrice} from '@/lib/pricing';
import {serviceDatePolicy} from './temporal';
import {businessLabels,businessServiceLabel} from './business-labels';

export function nextQualification(state:AgentState):AgentState['nextInput'] {
  const f=state.draftFacts;
  if(!f||state.booking)return;
  if(state.unresolvedInput)return state.unresolvedInput;
  if(state.pendingFactProposal)return 'FACT_CONFIRMATION';
  if(f.applianceScopePending?.length)return 'APPLIANCE_SCOPE';
  if(f.serviceConfirmationRequired)return 'SERVICE_CONFIRMATION';
  if(!f.service)return 'SERVICE_TYPE';
  if(!f.area)return 'AREA';
  if(!f.extrasConfirmed)return 'EXTRAS';
  if(!f.soilLevel)return 'SOIL_LEVEL';
  if(windowQuantitiesMissing(f))return f.windowCleaning?.totalCount?'WINDOW_TYPE':'WINDOW_COUNTS';
}
export function phoneOffer(text:string){
  return /(?:posaljem|pošaljem|poslati).{0,25}(?:broj|tel)|(?:send|give).{0,25}(?:phone|number)|(?:дать|пришлю|отправить).{0,25}(?:номер|телефон)/iu.test(text);
}
export function weekendQuestion(state:AgentState,locale:string,now=new Date()){
  const weekend=state.draftFacts?.requestedWeekend;
  if(!weekend)return;
  const allowed=[weekend.saturday,weekend.sunday].filter(date=>!('error' in serviceDatePolicy(date,{timezone:'Europe/Belgrade'},now)));
  if(allowed.length===2)return inputQuestion('WEEKEND_DAY',locale);
  if(allowed.length===1)return locale.startsWith('sr')?'Da li vam odgovara nedelja, '+allowed[0]+'?':locale==='en'?'Would Sunday, '+allowed[0]+', work for you?':'Вам подходит воскресенье, '+allowed[0]+'?';
  return locale.startsWith('sr')?'Taj vikend je prošao. Koji budući dan vam odgovara?':locale==='en'?'That weekend has passed. Which future day works for you?':'Этот выходной уже прошёл. Какой будущий день вам удобен?';
}
export function quoteText(state:AgentState,locale:string){
  const q=state.quote!;const sr=locale.startsWith('sr'),en=locale==='en',cyrl=locale==='sr-Cyrl';
  const service=businessServiceLabel(q.input.service,locale);
  const labels=businessLabels(locale);
  const lines=[service+' '+q.input.area+' m² — '+formatRsd(q.base,sr?'sr':locale)];
  for(const item of q.breakdown??[])lines.push(item.quantity+' '+(labels[item.code]??item.code)+' — '+formatRsd(item.amount,sr?'sr':locale));
  lines.push((cyrl?'Укупно за потврђене ставке: ':sr?'Ukupno za potvrđene stavke: ':en?'Known subtotal: ':'Сумма известных позиций: ')+formatRsd(q.total,sr?'sr':locale));
  if(state.draftFacts?.reviewItems?.includes('roletne'))lines.push(cyrl?'Ролетне: цену још проверавамо са тимом.':sr?'Roletne: cenu još proveravamo sa timom.':en?'Shutters: the team is reviewing the price.':'Рольставни: цену уточняет команда.');
  else if(q.requiresHumanReview||state.review?.reasons.length)lines.push(cyrl?'Тим још проверава детаље; ово није коначна цена.':sr?'Tim još proverava detalje; ovo nije konačna cena.':en?'The team is reviewing details; this is not the final price.':'Команда уточняет детали; это не окончательная цена.');
  if(state.duration&&state.draftFacts?.requestedCrew===state.duration.requiredCleaners)lines.push(cyrl?'За ову врсту чишћења планирамо '+state.duration.requiredCleaners+' особе.':sr?'Da, za ovu vrstu čišćenja planiramo '+state.duration.requiredCleaners+' osobe.':en?'The configured crew is '+state.duration.requiredCleaners+' cleaners.':'По правилам для этой уборки планируем '+state.duration.requiredCleaners+' человек.');
  return lines.join('\n');
}
export function quoteNeedsRefresh(state:AgentState,now=Date.now()){
 const q=state.quote;if(!q)return false;
 const current=calculatePrice(q.input.service,q.input.area,q.input.extras,q.input.urgent);
 return now-Date.parse(q.at)>30*60000||current.base!==q.base||current.extras.some(e=>!q.breakdown?.some(b=>b.code===e.code&&b.quantity===e.quantity&&b.unitPrice===e.unitPrice));
}
/** Deterministic high-confidence qualification and partial quotes. Scheduling remains in the existing tools. */
export async function conversionIntake(state:()=>AgentState,text:string,locale:string,tool:(name:ToolName,args:unknown)=>Promise<ToolResult>,previousInput?:AgentState['nextInput']):Promise<string|undefined>{
  let s=state(),f=s.draftFacts;
  if(!f||s.booking)return;
  const priceQuestion=/сколько.{0,60}(?:сто|все|всё|вместе)|какая.{0,25}цен|what.{0,25}(?:price|cost)|how much|koliko.{0,35}(?:kosta|košta|sve|cena)|колико.{0,35}(?:кошта|све|цена)/iu.test(text);
  if(priceQuestion)s.priceRequestPending=true;
  if(f.reviewItems?.length&&!s.review?.reasons.includes('CUSTOM_EXTRA'))await tool('requestReview',{reason:'CUSTOM_EXTRA'});
  if(f.preferredContactChannel&&f.preferredContactChannel!=='CURRENT_CHAT'){
    if(!s.review?.reasons.includes('CONTACT_PREFERENCE'))await tool('requestReview',{reason:'CONTACT_PREFERENCE'});
  }
  s=state();f=s.draftFacts;
  if(!priceQuestion&&!s.priceRequestPending&&(phoneOffer(text)||f?.preferredContactChannel==='SMS'&&!s.phone&&/sms|смс/iu.test(text))){
    const result=await tool('requestCustomerInput',{intent:'PHONE'});
    if(result.error)return;
    const suffix=locale.startsWith('sr')?'Zabeležiću da želite odgovor SMS-om i proslediću timu.':locale==='en'?'I will pass your SMS preference to the team.':'Сохраню пожелание ответа по SMS и передам команде.';
    return String(result.question)+' '+suffix;
  }
  if(!s.priceRequestPending&&f?.phone&&/^[+0][\d\s()-]{6,30}$/u.test(text.trim()))return locale.startsWith('sr')?'Broj je sačuvan. Prosleđujem timu vašu napomenu o željenom načinu kontakta.':locale==='en'?'Your number is saved. I am passing your contact preference to the team.':'Номер сохранён. Передаю команде пожелание о способе связи.';
  if(s.quote&&s.review?.reasons.length&&/^(?:ok[,!.\s]*)?(?:hvala|thanks|thank you|спасибо|хвала)[!.\s]*$/iu.test(text.trim()))return locale.startsWith('sr')?'Hvala vama. Tim proverava detalje za potvrdu; zatim možemo da uskladimo dan i kontakt.':locale==='en'?'Thank you. The team is reviewing the details; we can continue arranging the day and contact.':'Спасибо. Команда уточняет детали; дальше сможем согласовать день и контакт.';
  // Answer the new question before returning to qualification; facts are already saved at ingress.
  const schedulingQuestion=/во сколько|когда (?:можно|сможете)|what time|when can|u koliko|kada (?:možete|mozete)|у колико|када можете/iu.test(text);
  const quoteReady=!!f?.service&&!!f.area&&!!f.soilLevel&&!!f.extrasConfirmed&&!nextQualification(s);
  if(/\?|^(?:что|как|сколько|чем|какие|what|how|do you|can |koliko|kako|da li|šta|sta|колико|како|да ли|шта)/iu.test(text.trim())&&!priceQuestion&&!(schedulingQuestion&&quoteReady&&!s.quote))return;
  const intent=nextQualification(s);
  if(intent&&intent===previousInput&&!priceQuestion&&!s.priceRequestPending&&!s.unresolvedInput&&!s.pendingFactProposal&&f?.neighborhoodHint&&/^(?:lokacija|локација|район|district|location|banovo brdo)/iu.test(text.trim())){
    s.nextInput=intent;
    return locale==='sr-Cyrl'?'Рајон је забележен. Тачну адресу ћемо проверити пре избора термина.':locale.startsWith('sr')?'Zabeleženo. Tačnu adresu ćemo proveriti pre izbora termina.':locale==='en'?'The district is saved. We will verify the exact address before selecting a slot.':'Район сохранён. Точный адрес проверим перед выбором времени.';
  }
  if(intent){const result=await tool('requestCustomerInput',{intent});if(!result.error)return String(result.question);return;}
  if(f?.service&&f.area&&f.soilLevel&&f.extrasConfirmed&&!s.quote){
    const result=await tool('calculatePrice',{service:f.service,area:f.area,soilLevel:f.soilLevel,extras:f.extras??[],urgent:false});
    if(result.error)return;
    if(result.requiresHumanReview)await tool('requestReview',{reason:'PRICE_REVIEW'});
    const duration=await tool('estimateDuration',{});
    if(duration.error)await tool('requestReview',{reason:'NO_DURATION_RULE'});
    s=state();if(!s.quote)return;
    delete s.priceRequestPending;
    let resultText=quoteText(s,locale);
    if(f.requestedWeekend&&!f.requestedDate){await tool('requestCustomerInput',{intent:'WEEKEND_DAY'});resultText+='\n\n'+weekendQuestion(s,locale);}
    return resultText;
  }
  if(s.quote&&(priceQuestion||s.priceRequestPending||/уже (?:писал|написал|ответил)|я же написал|already (?:said|answered)|vec sam|већ сам/iu.test(text))){
    if(quoteNeedsRefresh(s)){
      const refreshed=await tool('calculatePrice',s.quote.input);
      if(refreshed.error)return locale==='sr-Cyrl'?'Ранији обрачун више није потврђен. Треба проверити актуелну цену пре резервације.':locale.startsWith('sr')?'Raniji obračun više nije potvrđen. Treba proveriti aktuelnu cenu pre rezervacije.':locale==='en'?'The earlier quote is no longer verified. We need to check the current price before booking.':'Прежний расчёт больше не подтверждён. Текущую цену нужно проверить до оформления.';
      s=state();if(!s.quote)return;
    }
    delete s.priceRequestPending;return quoteText(s,locale);
  }
}
