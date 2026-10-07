import type { AgentState } from './contracts';
import { customerFactsSchema } from './contracts';
import { resolveCustomerDate } from './temporal';
import { behaviorMetric } from './behavior-telemetry';
import {conversionFacts,plain,serviceNeedsConfirmation} from './conversion-facts';

export type CustomerFacts = NonNullable<AgentState['draftFacts']>;
/** Deliberately narrow. Unclear quantities, negations and word-only times require clarification. */
export function explicitCustomerFacts(text: string, sentAt: Date, timezone: string, expectedInput?: AgentState['nextInput'],state?:AgentState): CustomerFacts {
  const facts: CustomerFacts = conversionFacts(text,sentAt,timezone,expectedInput,state);
  if(expectedInput==='AREA'&&/^\d{1,4}(?:[.,]\d+)?[.!\s]*$/u.test(text.trim())){const value=Number(text.trim().replace(/[.!]+$/u,'').replace(',','.'));if(value>=1&&value<=1000)facts.area=value;}
  if(expectedInput==='SOIL_LEVEL'&&/^(?:обычн[а-я]*|normal|uobičajena|uobicajena|уобичајена)[.!\s]*$/iu.test(text.trim()))facts.soilLevel='NORMAL';
  if(expectedInput==='SOIL_LEVEL'&&/^(?:сильн[а-я]*|heavy|jaka|јака)[.!\s]*$/iu.test(text.trim()))facts.soilLevel='HEAVY';
  const areas = [...text.matchAll(/(\d{1,4}(?:[.,]\d+)?)\s*(?:м[²2]|m[²2]|квадрат\w*|kvadrat\w*|sq\.?\s*m|square met(?:er|re)s)/giu)];
  if (areas.length) { const area = Number(areas.at(-1)![1].replace(',', '.')); if (area >= 1 && area <= 1000) facts.area = area; }
  const services = [...text.matchAll(/поддерживающ\w*|регулярн\w*|обычн[а-яё]* уборк\w*|генеральн\w*|\bregular(?: cleaning)?\b|\bdeep(?: cleaning)?\b|\bredovn\w*\b|\bdubinsk\w*\b|редовн\w*|дубинск\w*/giu)];
  if (services.length&&!serviceNeedsConfirmation(text)) facts.service = /генеральн|deep|dubinsk|дубинск/iu.test(services.at(-1)![0]) ? 'deep' : 'regular';
  const normalized=plain(text);
  if(!serviceNeedsConfirmation(text)){
    if(expectedInput==='SERVICE_CONFIRMATION'&&/^(?:generalno|генерално)[.!\s]*$/iu.test(text.trim()))facts.service='deep';
    if(expectedInput==='SERVICE_CONFIRMATION'&&/^(?:odrzavajuce|redovno|одржавајуће|редовно)[.!\s]*$/iu.test(normalized.trim()))facts.service='regular';
    if(/generalno\s+ciscenje|generalka|генерално чишћење|detaljno ciscenje (?:stana|kuce|prostora)/iu.test(normalized)&&!/ne generalno|bez generalnog/iu.test(normalized))facts.service='deep';
    if(/odrzavajuce|одржавајуће|(?:zelim|ipak|nego) redovno|ne generalno,? nego redovno/iu.test(normalized))facts.service='regular';
    // Furniture/carpet extraction is not an apartment service choice.
    if(/dubinsk|дубинск/iu.test(normalized)&&/krevet|tepih|tepiha|sofa|mattress|carpet|диван|матрас|ковр/iu.test(normalized)&&!facts.serviceConfirmationRequired)delete facts.service;
  }
  if (/обычн[а-яё]* загрязн|загрязнен[а-яё]* обычн|normal (?:dirt|soil)|uobičajena zaprljanost|uobicajena zaprljanost|уобичајена запрљаност/iu.test(text)) facts.soilLevel = 'NORMAL';
  if (/сильн[а-яё]* загрязн|heavy (?:dirt|soil)|jaka zaprljanost|јака запрљаност/iu.test(text)) facts.soilLevel = 'HEAVY';
  if (/экстремальн[а-яё]* загрязн|extreme (?:dirt|soil)|екстремн\w*|ekstremn/iu.test(text)) facts.soilLevel = 'EXTREME';
  if (/без (?:дополнительных услуг|допов|дополнений)|ничего дополнительно|no extras|bez dodatnih usluga|без додатних услуга/iu.test(text)) { facts.extras = []; facts.extrasConfirmed = true; }
  const extra = /(?:внутри духовки|духовк[а-яё]* внутри|(?:добав|еще|ещё|нужн[а-яё]*).{0,15}духовк[а-яё]*|inside (?:the )?oven|rerna iznutra|rernu iznutra|рерн\w* изнутра)/iu.test(text) ? 'oven' : /холодильник[а-яё]* внутри|внутри холодильник|inside (?:the )?fridge|frižider iznutra|фрижидер изнутра/iu.test(text) ? 'fridge' : undefined;
  if (extra && !/не нуж|не надо|don't|do not|bez |без /iu.test(text)) { facts.extras = [{ code: extra, quantity: 1 }]; facts.extrasConfirmed = true; }
  const address=text.match(/^(?:адрес|address|adresa|адреса)[:\s]+(.{3,200})$/iu)?.[1];
  if(address)facts.addressQuery=address.trim();
  const date = resolveCustomerDate(text, sentAt, timezone);
  if (date) facts.requestedDate = date;
  return facts;
}
export function applyCustomerFacts(state: AgentState, incoming: CustomerFacts, currentLocalDate?:string) {
  const facts = customerFactsSchema.parse(incoming);
  const before: CustomerFacts = state.draftFacts ?? (state.quote ? { service:state.quote.input.service,area:state.quote.input.area,soilLevel:state.quote.input.soilLevel,extras:state.quote.input.extras,extrasConfirmed:true } : {});
  // Additive selections: a generic refusal means no OTHER extras. Only named refusals remove selections.
  if(facts.extras)facts.extras=[...(before.extras??[]).filter(e=>!facts.extras!.some(n=>n.code===e.code)),...facts.extras];
  if(facts.declinedExtras)facts.extras=(facts.extras??before.extras??[]).filter(e=>!facts.declinedExtras!.includes(e.code as 'oven'));
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
      }
      facts.extrasConfirmed=true;
    }
  }
  const changed = Object.keys(facts).filter(key => JSON.stringify(before[key as keyof CustomerFacts]) !== JSON.stringify(facts[key as keyof CustomerFacts]));
  const confirmedService=!!facts.service&&!facts.serviceConfirmationRequired&&!!before.serviceConfirmationRequired;
  if (!changed.length&&!confirmedService) return false;
  if(confirmedService)changed.push('serviceConfirmationRequired');
  if (changed.some(key => before[key as keyof CustomerFacts] !== undefined)) behaviorMetric('customerCorrectionCount');
  state.draftFacts = { ...before, ...facts };
  if(facts.service&&!facts.serviceConfirmationRequired)delete state.draftFacts.serviceConfirmationRequired;
  if(facts.phone)state.phone=facts.phone;
  if(facts.preferredContactChannel)state.preferredContactChannel=facts.preferredContactChannel;
  delete state.nextInput;
  if (changed.some(key => ['service','area','soilLevel','extras','extrasConfirmed','windowCleaning','reviewItems','serviceConfirmationRequired'].includes(key)||key==='requestedDate'&&(!currentLocalDate||!!state.quote&&state.quote.input.urgent!==(facts.requestedDate===currentLocalDate)))) {
    delete state.qualification; delete state.quote; delete state.duration;
  }
  if (changed.includes('addressQuery')) { delete state.address; delete state.addressCandidates; }
  delete state.slots; delete state.selectedSlotToken; delete state.pending; delete state.requestedWindow;
  // Date changes may cross midnight: quote urgency is reconciled against actual now by tools.
  return true;
}
export function supportedFacts(facts: CustomerFacts, evidence: CustomerFacts) {
  return Object.entries(facts).every(([key, value]) => JSON.stringify(value) === JSON.stringify(evidence[key as keyof CustomerFacts]));
}
