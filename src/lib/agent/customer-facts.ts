import {directBusinessQuestion} from './knowledge/search';
import type { AgentState } from './contracts';
import { customerFactsSchema } from './contracts';
import { resolveCustomerDate } from './temporal';
import { behaviorMetric } from './behavior-telemetry';
import {conversionFacts,plain,serviceNeedsConfirmation,catalogQuestion} from './conversion-facts';
import {applianceFacts} from './appliance-facts';
import {normalizedPhone} from '@/lib/domain/crm';
import {reliabilityCount} from './reliability-telemetry';

export type CustomerFacts = NonNullable<AgentState['draftFacts']>;
function stable(value:unknown):unknown{return Array.isArray(value)?value.map(stable):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,v])=>[key,stable(v)])):value;}
export function equivalentCustomerFact(key:string,a:unknown,b:unknown){
 const normalized=(value:unknown)=>key==='extras'&&Array.isArray(value)?value.filter(e=>e.quantity>0).sort((x,y)=>x.code.localeCompare(y.code)):['declinedExtras','reviewItems'].includes(key)&&Array.isArray(value)?[...value].sort():value;
 return JSON.stringify(stable(normalized(a)))===JSON.stringify(stable(normalized(b)));
}
/** Deliberately narrow. Unclear quantities, negations and word-only times require clarification. */
export function explicitCustomerFacts(text: string, sentAt: Date, timezone: string, expectedInput?: AgentState['nextInput'],state?:AgentState,consultationFiltered=false): CustomerFacts {
  if(!consultationFiltered&&directBusinessQuestion(text)){
    const declarations=text.match(/[^.!?]+[.!?]?/gu)?.filter(s=>!directBusinessQuestion(s)&&!s.trim().endsWith('?')).join(' ').trim();
    return declarations&&declarations!==text.trim()?explicitCustomerFacts(declarations,sentAt,timezone,expectedInput,state,true):serviceNeedsConfirmation(text)?{serviceConfirmationRequired:true}:{};
  }
  const facts: CustomerFacts = conversionFacts(text,sentAt,timezone,expectedInput,state);
  const name=text.match(/(?:^|[\n;,])\s*(?:меня зовут|мо[её] имя|имя|my name is|name|zovem se|ime(?: je)?|ја се зовем|зовем се)[:\s]+([\p{L}][\p{L} .'-]{1,99})(?=$|[\n;,])/iu)?.[1];
  if(name)facts.name=name.trim();
  if(!facts.name&&expectedInput==='NAME'&&/^[\p{L}][\p{L} .'-]{1,99}$/u.test(text.trim())&&!/^(?:да|нет|ага|угу|хорошо|ладно|ок|окей|понятно|ал[л]?о|ал[л]?ё|спасибо|позже|потом|не знаю|не хочу|yes|no|ok|okay|hello|thanks|later|da|ne|u redu|važi|vazi|важи|hvala|ne znam|не знам|я уже ответил|да я же написал|already answered|vec sam odgovorio)[.!\s]*$/iu.test(text.trim()))facts.name=text.trim();
  const namedPhones=[...text.matchAll(/(?:^|[\n;,])\s*(?:phone|телефон|telefon|tel)\s*[:=]?\s*([+0][\d ()-]{5,30})/giu)];
  if(namedPhones.length===1){const phone=normalizedPhone(namedPhones[0][1]);if(phone)facts.phone=phone;}
  const areaCorrection=state?.draftFacts?.area&&text.trim().match(/^(?:нет|не|ne|no)[,\s]+(\d{1,4}(?:[.,]\d+)?)[.!\s]*$/iu);
  if(areaCorrection&&!['WINDOW_COUNTS','WINDOW_TYPE'].includes(expectedInput??'')){const area=Number(areaCorrection[1].replace(',','.'));if(area>=1&&area<=1000)facts.area=area;}
  if(expectedInput==='AREA'&&/^\d{1,4}(?:[.,]\d+)?[.!\s]*$/u.test(text.trim())){const value=Number(text.trim().replace(/[.!]+$/u,'').replace(',','.'));if(value>=1&&value<=1000)facts.area=value;}
  if(expectedInput==='SOIL_LEVEL'&&/^(?:обычн[а-я]*|normal|uobičajena|uobicajena|уобичајена)[.!\s]*$/iu.test(text.trim()))facts.soilLevel='NORMAL';
  if(expectedInput==='SOIL_LEVEL'&&/^(?:сильн[а-я]*|heavy|jaka|јака)[.!\s]*$/iu.test(text.trim()))facts.soilLevel='HEAVY';
  const areas = [...text.matchAll(/(?<![-+\d.,])(\d{1,4}(?:[.,]\d+)?)\s*(?:м[²2]|m[²2]|квадрат\w*|kvadrat\w*|sq\.?\s*m|square met(?:er|re)s|метр[а-яё]*)/giu)].filter(m=>!/метр/iu.test(m[0])||!/(?:длин|ширин|высот|length|width|height)/iu.test(text.slice(Math.max(0,m.index!-20),m.index!+m[0].length+20)));
  if (areas.length) { const area = Number(areas.at(-1)![1].replace(',', '.')); if (area >= 1 && area <= 1000) facts.area = area; }
  if(new Set(areas.map(m=>m[1])).size>1&&/или|\bor\b|\bili\b|или/iu.test(text)&&!/нет|не .{0,10}а |correction|isprav|исправ/iu.test(text))delete facts.area;
  if(/\d+\s*(?:или|or|ili)\s*\d+\s*(?:м[²2]|m[²2]|метр|квадрат|kvadrat|square)/iu.test(text))delete facts.area;
  if(catalogQuestion(text))delete facts.area;
  const services = [...text.matchAll(/поддерживающ\w*|регулярн\w*|обычн[а-яё]* уборк\w*|генеральн\w*|\bregular(?: cleaning)?\b|\bdeep(?: cleaning)?\b|\bredovn\w*\b|\bdubinsk\w*\b|редовн\w*|дубинск\w*/giu)];
  if (services.length&&!serviceNeedsConfirmation(text)&&!catalogQuestion(text)) facts.service = /генеральн|deep|dubinsk|дубинск/iu.test(services.at(-1)![0]) ? 'deep' : 'regular';
  const normalized=plain(text);
  if(!serviceNeedsConfirmation(text)&&!catalogQuestion(text)){
    if(expectedInput==='SERVICE_CONFIRMATION'&&/^(?:generalno|генерално)[.!\s]*$/iu.test(text.trim()))facts.service='deep';
    if(expectedInput==='SERVICE_CONFIRMATION'&&/^(?:odrzavajuce|redovno|одржавајуће|редовно)[.!\s]*$/iu.test(normalized.trim()))facts.service='regular';
    if(/generalno\s+ciscenje|generalka|генералка|генерално чишћење|detaljno ciscenje (?:stana|kuce|prostora)/iu.test(normalized)&&!/ne generalno|bez generalnog|не генералк|без генералк/iu.test(normalized))facts.service='deep';
    if(/odrzavajuce|одржавајуће|(?:zelim|ipak|nego) redovno|ne generalno,? nego redovno/iu.test(normalized))facts.service='regular';
    // Furniture/carpet extraction is not an apartment service choice.
    if(/dubinsk|дубинск/iu.test(normalized)&&/krevet|tepih|tepiha|sofa|mattress|carpet|диван|матрас|ковр/iu.test(normalized)&&!facts.serviceConfirmationRequired)delete facts.service;
  }
  if (/обычн[а-яё]* загрязн|загрязнен[а-яё]* обычн|normal (?:dirt|soil)|uobičajena zaprljanost|uobicajena zaprljanost|уобичајена запрљаност/iu.test(text)) facts.soilLevel = 'NORMAL';
  if (/сильн[а-яё]* загрязн|heavy (?:dirt|soil)|jaka zaprljanost|јака запрљаност/iu.test(text)) facts.soilLevel = 'HEAVY';
  if (/экстремальн[а-яё]* загрязн|extreme (?:dirt|soil)|екстремн\w*|ekstremn/iu.test(text)) facts.soilLevel = 'EXTREME';
  if (/без (?:дополнительных услуг|допов|дополнений)|ничего дополнительно|больше ничего|no extras|nothing else|bez dodatnih usluga|nista vise|ništa više|без додатних услуга|ништа више/iu.test(text)) { facts.extras = []; facts.extrasConfirmed = true; }
  Object.assign(facts,applianceFacts(text,expectedInput,state));
  const address=text.match(/^(?:адрес|address|adresa|адреса)[:\s]+(.{3,200})$/iu)?.[1];
  if(address)facts.addressQuery=address.trim();
  const date = resolveCustomerDate(text, sentAt, timezone);
  if (date) facts.requestedDate = date;
  return facts;
}
export function applyCustomerFacts(state: AgentState, incoming: CustomerFacts, currentLocalDate?:string) {
  const facts = customerFactsSchema.parse(incoming);
  const before: CustomerFacts = state.draftFacts ?? (state.quote ? { service:state.quote.input.service,area:state.quote.input.area,soilLevel:state.quote.input.soilLevel,extras:state.quote.input.extras,extrasConfirmed:true } : {});
  // A later explicit re-add supersedes an earlier refusal; replaying the complete draft must not remove it again.
  if((before.declinedExtras!==undefined||facts.declinedExtras!==undefined)&&facts.extras?.some(e=>e.quantity>0))facts.declinedExtras=[...new Set([...(before.declinedExtras??[]),...(facts.declinedExtras??[])])].filter(code=>!facts.extras!.some(e=>e.code===code&&e.quantity>0)||incoming.declinedExtras?.includes(code));
  // Additive selections: a generic refusal means no OTHER extras. Only named refusals remove selections.
  if(facts.extras)facts.extras=[...(before.extras??[]).filter(e=>!facts.extras!.some(n=>n.code===e.code)),...facts.extras];
  if(facts.declinedExtras)facts.extras=(facts.extras??before.extras??[]).filter(e=>!facts.declinedExtras!.includes(e.code));
  if(facts.windowCleaning){
    const w=facts.windowCleaning;
    facts.windowCleaning=w.requested?{...(before.windowCleaning?.requested?before.windowCleaning:{}),...w}:w;
    if(w.totalCount!==undefined){delete facts.windowCleaning.standardCount;delete facts.windowCleaning.largeCount;}
    else if(w.standardCount!==undefined||w.largeCount!==undefined)delete facts.windowCleaning.totalCount;
    if(!w.requested||w.standardCount!==undefined||w.largeCount!==undefined){
      const merged=facts.windowCleaning;
      facts.extras=(facts.extras??before.extras??[]).filter(e=>e.code!=='standardWindow'&&e.code!=='largeWindow');
      if(merged.requested){
        if(merged.standardCount)facts.extras.push({code:'standardWindow',quantity:merged.standardCount});
        if(merged.largeCount)facts.extras.push({code:'largeWindow',quantity:merged.largeCount});
        if(before.declinedExtras?.length||facts.declinedExtras?.length)facts.declinedExtras=(facts.declinedExtras??before.declinedExtras??[]).filter(code=>!facts.extras!.some(e=>e.code===code&&e.quantity>0));
      }
      facts.extrasConfirmed=true;
    }
  }
  const changed = Object.keys(facts).filter(key => !equivalentCustomerFact(key,before[key as keyof CustomerFacts],facts[key as keyof CustomerFacts]));
  const confirmedService=!!facts.service&&!facts.serviceConfirmationRequired&&!!before.serviceConfirmationRequired;
  if (!changed.length&&!confirmedService) return false;
  if(confirmedService)changed.push('serviceConfirmationRequired');
  if (changed.some(key => before[key as keyof CustomerFacts] !== undefined)){behaviorMetric('customerCorrectionCount');reliabilityCount(state,'factCorrection');}
  state.draftFacts = { ...before, ...facts };
  if(state.pendingFactProposal&&changed.some(k=>Object.hasOwn(state.pendingFactProposal!.facts,k)))delete state.pendingFactProposal;
  if(facts.service&&!facts.serviceConfirmationRequired)delete state.draftFacts.serviceConfirmationRequired;
  if(facts.phone)state.phone=facts.phone;
  if(facts.name)state.name=facts.name;
  if(facts.preferredContactChannel)state.preferredContactChannel=facts.preferredContactChannel;
  delete state.nextInput;
  if (changed.some(key => ['service','area','soilLevel','extras','extrasConfirmed','windowCleaning','bathroomCount','reviewItems','serviceConfirmationRequired','applianceScopePending'].includes(key)||key==='requestedDate'&&(!currentLocalDate||!!state.quote&&state.quote.input.urgent!==(facts.requestedDate===currentLocalDate)))) {
    delete state.qualification; delete state.quote; delete state.duration;
  }
  if (changed.includes('addressQuery')) { delete state.address; delete state.addressCandidates; }
  const routingChanged=changed.includes('addressQuery');
  const dateChanged=changed.includes('requestedDate');
  const cleaningChanged=changed.some(key=>['service','area','soilLevel','extras','extrasConfirmed','windowCleaning','bathroomCount','reviewItems','serviceConfirmationRequired','applianceScopePending'].includes(key));
  if(cleaningChanged||routingChanged||dateChanged){delete state.slots;delete state.selectedSlotToken;delete state.pending;}
  if(dateChanged)delete state.requestedWindow;
  if(changed.includes('phone')||changed.includes('name'))delete state.pending; // A recap must be confirmed for the current contact.
  // Date changes may cross midnight: quote urgency is reconciled against actual now by tools.
  return true;
}
export function supportedFacts(facts: CustomerFacts, evidence: CustomerFacts) {
  return Object.entries(facts).every(([key, value]) => {
    if(key==='extras'&&Array.isArray(facts.extras)&&Array.isArray(evidence.extras))return facts.extras.length?facts.extras.every(item=>evidence.extras!.some(e=>e.code===item.code&&e.quantity===item.quantity)):evidence.extras.length===0;
    if(['declinedExtras','reviewItems'].includes(key)&&Array.isArray(value)){const known=evidence[key as keyof CustomerFacts];return Array.isArray(known)&&value.every(v=>known.includes(v as never));}
    return equivalentCustomerFact(key,value,evidence[key as keyof CustomerFacts]);
  });
}
