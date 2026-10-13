import type {AgentLocale, AgentState, HandoffReason} from './contracts';
import {nextQualification,quoteText} from './conversion-intake';
import {inputQuestion} from './chat-presentation';

export const softReasons = ['DISCOUNT','PRICE_REVIEW','CREW_PREFERENCE','ACCESS_REVIEW','PAYMENT_REVIEW','OUTSIDE_SERVICE_AREA','NO_DURATION_RULE','ROUTING_UNRELIABLE'] as const;
export function reasonLevel(reason:string):'AI_HANDLES'|'SOFT_REVIEW'|'HARD_HANDOFF' {
 if(['NO_SLOTS','AMBIGUOUS'].includes(reason))return 'AI_HANDLES';
 return (softReasons as readonly string[]).includes(reason)?'SOFT_REVIEW':'HARD_HANDOFF';
}
/** A topic mention is not authorization or a request to perform exceptional work. */
export function contextualReason(text:string,reason:HandoffReason|null):HandoffReason|null {
 if(!reason)return null;
 const question=/\?|^(?:как|что|есть|какие|можно ли|do you|how|what|are there|can i|da li|kako|šta|sta|да ли|како|шта)/iu.test(text.trim());
 const exception=/индивидуаль|сделайте.{0,20}скид|дайте.{0,20}скид|хочу.{0,20}скид|special discount|give me.{0,20}discount|\bcustom\b|\bexception\b|poseban popust|dajte.{0,20}popust|посебан попуст|дајте.{0,20}попуст/iu.test(text);
 if(reason==='DISCOUNT'&&question&&!exception)return null;
 if(reason==='PAYMENT_REVIEW'&&question&&!/сч[её]т.{0,20}(?:компан|фирм)|invoice|faktur|фактур|только.{0,15}карт|only.{0,15}card/iu.test(text))return null;
 if(reason==='ACCESS_REVIEW'&&question&&!/хран|хранить|keep|store|čuv|cuv|чув|остав.{0,25}(?:навсегда|недел)|leave.{0,25}week/iu.test(text))return null;
 if(reason==='ARRIVAL_REVIEW'&&!/где|where|gde|где|опазд|late|kasn|касн|\beta\b/iu.test(text))return null;
 if(['MOLD','RENOVATION','HAZARDOUS_CLEANING','HEAVY_LIFTING'].includes(reason)){
  const serviceQuestion=/^(?:вы|а вы|do you|does lumaclean|da li|да ли).{0,70}(?:делаете|убираете|моете|чистите|clean|remove|offer|carry|move|čist|cist|uklanj|pomer|чист|уклањ|помер)/iu.test(text.trim());
  const actual=/у меня|у нас|мой|мою|нам нужно|мне нужно|помогите|нужно.{0,25}(?:убрать|переставить)|my |our |please |help |treba mi|kod mene|треба ми|код мене/iu.test(text);
  if(serviceQuestion&&!actual)return null;
 }
 if(reason==='CANCELLATION'&&/^(?:как|what|how|kako|како).{0,30}(?:отмен|cancel|otkaz|отказ)/iu.test(text.trim()))return null;
 return reason;
}

const clarificationCodes=new Set(['INVALID_TOOL_ARGUMENTS','INVALID_PHONE','CONTACT_REQUIRED','ADDRESS_REQUIRED','ADDRESS_NOT_FOUND','ADDRESS_SELECTION_REQUIRED','QUOTE_REQUIRED','CUSTOMER_FACTS_REQUIRED','HUMAN_CONTEXT_REQUIRED','FACT_ALREADY_KNOWN','SAME_DAY_CUTOFF','PAST_SERVICE_DATE','PAST_DEPARTURE','URGENT_REPRICE_REQUIRED','INVALID_DATE_WINDOW','CUSTOMER_DATE_MISMATCH','CUSTOMER_CORRECTION_REQUIRES_CURRENT_FACTS','DATE_REQUIRED','TIME_WINDOW_REQUIRED','PAST_START_TIME','SERVICE_CONFIRMATION_REQUIRED','WINDOW_QUANTITIES_REQUIRED','SLOTS_REQUIRED','INPUT_CONTEXT_REQUIRED','UPHOLSTERY_MANAGER_INTAKE','UPHOLSTERY_REVIEW_REQUIRED','REVIEW_REQUIRED','EXPLICIT_CONFIRMATION_REQUIRED','INCOMPLETE_BOOKING','STALE_SLOT','SLOT_NO_LONGER_AVAILABLE','AMBIGUOUS','NO_SLOTS','TOOL_READ_TEMPORARY']);
export function transientReadFailure(tool:string,error:unknown){return ['getBusinessInfo','findClient'].includes(tool)&&!!error&&typeof error==='object'&&['ETIMEDOUT','ECONNRESET','ECONNREFUSED','P2024','P1001','P1002'].includes(String((error as {code?:string}).code));}
export function errorDisposition(code:string):'CLARIFY'|'REVIEW'|'HARD' {
 if(clarificationCodes.has(code)||code==='SHADOW_MUTATION_BLOCKED')return 'CLARIFY';
 if(['NO_DURATION_RULE','ROUTING_UNRELIABLE','PRICE_REVIEW','PRICE_CHANGED','SERVICE_UNAVAILABLE','EXTRA_UNAVAILABLE','RESCHEDULE_REVIEW_REQUIRED','UNSUPPORTED_SERVICE'].includes(code))return 'REVIEW';
 return 'HARD';
}
export function recoveryText(locale:AgentLocale){
 return {ru:'Не удалось достоверно завершить этот шаг. Данные заявки сохранены; запись не подтверждена. Уточните, пожалуйста, какой вопрос проверить дальше.',en:'I could not reliably complete this step. Your inquiry details are saved; no booking is confirmed. Which question should I check next?','sr-Latn':'Nisam uspela pouzdano da završim ovaj korak. Detalji upita su sačuvani; rezervacija nije potvrđena. Koje pitanje da proverim sledeće?','sr-Cyrl':'Нисам успела поуздано да завршим овај корак. Детаљи упита су сачувани; резервација није потврђена. Које питање да проверим следеће?'}[locale];
}
export function noSlotsText(locale:AgentLocale){return {ru:'На выбранное время свободных слотов не найдено. Какой другой день или интервал проверить?',en:'No slots were found for that time. Which other day or time window should I check?','sr-Latn':'Nema slobodnih termina za izabrano vreme. Koji drugi dan ili period da proverim?','sr-Cyrl':'Нема слободних термина за изабрано време. Који други дан или период да проверим?'}[locale];}
export function safeRecovery(state:AgentState,locale:AgentLocale){
 if(state.booking)return ({ru:'Запись подтверждена: ','en':'Booking confirmed: ','sr-Latn':'Rezervacija je potvrđena: ','sr-Cyrl':'Резервација је потврђена: '}[locale])+state.booking.reference+'. '+state.booking.price+' RSD.';
 if(state.quote)return quoteText(state,locale);
 const next=nextQualification(state);
 if(next){state.nextInput=next;return inputQuestion(next,locale)??recoveryText(locale);}
 return recoveryText(locale);
}
