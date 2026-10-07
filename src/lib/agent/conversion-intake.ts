import type {AgentState,ToolName,ToolResult} from './contracts';
import {windowQuantitiesMissing} from './conversion-facts';
import {inputQuestion} from './chat-presentation';
import {formatRsd} from '@/lib/pricing';
import {serviceDatePolicy} from './temporal';
import {siteContent} from '@/lib/content';

export function nextQualification(state:AgentState):AgentState['nextInput'] {
  const f=state.draftFacts;
  if(!f||state.booking)return;
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
  const q=state.quote!;const sr=locale.startsWith('sr'),en=locale==='en';
  const service=siteContent[sr?'sr':en?'en':'ru'].services.find(s=>s.id===q.input.service)!.name;
  const labels:Record<string,string> = sr?{largeWindow:'velikih prozora',standardWindow:'standardna prozora'}:en?{largeWindow:'large windows',standardWindow:'standard windows'}:{largeWindow:'больших окон',standardWindow:'стандартных окон'};
  const lines=[service+' '+q.input.area+' m² — '+formatRsd(q.base,sr?'sr':locale)];
  for(const item of q.breakdown??[])lines.push(item.quantity+' '+(labels[item.code]??item.code)+' — '+formatRsd(item.amount,sr?'sr':locale));
  lines.push((sr?'Ukupno za potvrđene stavke: ':en?'Known subtotal: ':'Сумма известных позиций: ')+formatRsd(q.total,sr?'sr':locale));
  if(state.draftFacts?.reviewItems?.includes('roletne'))lines.push(sr?'Roletne: cenu još proveravamo sa timom.':en?'Shutters: the team is reviewing the price.':'Рольставни: цену уточняет команда.');
  else if(q.requiresHumanReview||state.review?.reasons.length)lines.push(sr?'Tim još proverava detalje; ovo nije konačna cena.':en?'The team is reviewing details; this is not the final price.':'Команда уточняет детали; это не окончательная цена.');
  if(state.duration&&state.draftFacts?.requestedCrew===state.duration.requiredCleaners)lines.push(sr?'Da, za ovu vrstu čišćenja planiramo '+state.duration.requiredCleaners+' osobe.':en?'The configured crew is '+state.duration.requiredCleaners+' cleaners.':'По правилам для этой уборки планируем '+state.duration.requiredCleaners+' человек.');
  return lines.join('\n');
}
/** Deterministic high-confidence qualification and partial quotes. Scheduling remains in the existing tools. */
export async function conversionIntake(state:()=>AgentState,text:string,locale:string,tool:(name:ToolName,args:unknown)=>Promise<ToolResult>,previousInput?:AgentState['nextInput']):Promise<string|undefined>{
  let s=state(),f=s.draftFacts;
  if(!f||s.booking)return;
  if(f.reviewItems?.length&&!s.review?.reasons.includes('CUSTOM_EXTRA'))await tool('requestReview',{reason:'CUSTOM_EXTRA'});
  if(f.preferredContactChannel&&f.preferredContactChannel!=='CURRENT_CHAT'){
    if(!s.review?.reasons.includes('CONTACT_PREFERENCE'))await tool('requestReview',{reason:'CONTACT_PREFERENCE'});
  }
  s=state();f=s.draftFacts;
  if(phoneOffer(text)||f?.preferredContactChannel==='SMS'&&!s.phone&&/sms|смс/iu.test(text)){
    const result=await tool('requestCustomerInput',{intent:'PHONE'});
    if(result.error)return;
    const suffix=locale.startsWith('sr')?'Zabeležiću da želite odgovor SMS-om i proslediću timu.':locale==='en'?'I will pass your SMS preference to the team.':'Сохраню пожелание ответа по SMS и передам команде.';
    return String(result.question)+' '+suffix;
  }
  if(f?.phone&&/^[+0][\d\s()-]{6,30}$/u.test(text.trim()))return locale.startsWith('sr')?'Broj je sačuvan. Prosleđujem timu vašu napomenu o željenom načinu kontakta.':locale==='en'?'Your number is saved. I am passing your contact preference to the team.':'Номер сохранён. Передаю команде пожелание о способе связи.';
  const intent=nextQualification(s);
  // An unrelated fact can clear nextInput during merging, but it does not answer
  // the question already shown to the customer. Keep its response context.
  if(intent&&intent===previousInput&&['AREA','EXTRAS','SOIL_LEVEL','WINDOW_COUNTS','WINDOW_TYPE'].includes(intent)){
    s.nextInput=intent;
    return locale.startsWith('sr')?'Zabeleženo. Nastavljamo od prethodnog pitanja.':locale==='en'?'Noted. We can continue from the previous question.':'Записала. Продолжим с предыдущего вопроса.';
  }
  if(intent){const result=await tool('requestCustomerInput',{intent});if(!result.error)return String(result.question);return;}
  if(f?.service&&f.area&&f.soilLevel&&f.extrasConfirmed&&!s.quote){
    const result=await tool('calculatePrice',{service:f.service,area:f.area,soilLevel:f.soilLevel,extras:f.extras??[],urgent:false});
    if(result.error)return;
    if(result.requiresHumanReview)await tool('requestReview',{reason:'PRICE_REVIEW'});
    const duration=await tool('estimateDuration',{});
    if(duration.error)await tool('requestReview',{reason:'NO_DURATION_RULE'});
    s=state();if(!s.quote)return;
    let resultText=quoteText(s,locale);
    if(f.requestedWeekend&&!f.requestedDate){await tool('requestCustomerInput',{intent:'WEEKEND_DAY'});resultText+='\n\n'+weekendQuestion(s,locale);}
    return resultText;
  }
}
