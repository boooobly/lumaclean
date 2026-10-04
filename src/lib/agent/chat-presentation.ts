import { randomInt, randomUUID } from "node:crypto";
import type { AgentLocale, AgentState } from "./contracts";
export const displayAliases = [
  "Anna",
  "Sofia",
  "Mila",
  "Elena",
  "Nina",
  "Maria",
  "Sara",
  "Maya",
  "Natalia",
  "Aleksandra",
] as const;
export function chooseAlias(recent: readonly string[] = []) {
  const choices = displayAliases.filter((a) => !recent.slice(0, 3).includes(a));
  return choices[randomInt(choices.length)];
}
const replies = {
  SERVICE_REGULAR: [
    "Обычная уборка",
    "Redovno čišćenje",
    "Редовно чишћење",
    "Regular cleaning",
  ],
  SERVICE_DEEP: [
    "Генеральная уборка",
    "Dubinsko čišćenje",
    "Дубинско чишћење",
    "Deep cleaning",
  ],
  SERVICE_MOVE: [
    "При переезде",
    "Čišćenje pri selidbi",
    "Чишћење при селидби",
    "Move cleaning",
  ],
  SOIL_NORMAL: [
    "Обычное загрязнение",
    "Uobičajena zaprljanost",
    "Уобичајена запрљаност",
    "Normal dirt",
  ],
  SOIL_HEAVY: [
    "Сильное загрязнение",
    "Jaka zaprljanost",
    "Јака запрљаност",
    "Heavy dirt",
  ],
  NO_EXTRAS: [
    "Без дополнительных услуг",
    "Bez dodatnih usluga",
    "Без додатних услуга",
    "No extras",
  ],
  ASK_QUESTION: ["Задать вопрос", "Postavi pitanje", "Постави питање", "Ask a question"],
  CONFIRM_BOOKING: ["Подтверждаю бронирование", "Potvrđujem", "Потврђујем", "I confirm the booking"],
  YES: ["Да", "Da", "Да", "Yes"],
  NO: ["Нет", "Ne", "Не", "No"],
} as const;
export type ReplyKey = keyof typeof replies;
const languages: AgentLocale[] = ["ru", "sr-Latn", "sr-Cyrl", "en"];
export function replyText(key: ReplyKey, locale: string) {
  return replies[key][Math.max(0, languages.indexOf(locale as AgentLocale))];
}
export type QuickReply = { key: string; label: string };
export type ReplySet = { id:string; intent:NonNullable<AgentState['nextInput']>; choices:QuickReply[]; conversationRevision:number; createdAt:string; consumedAt:string|null; expiresAt:string };
const questions:Record<string,string[]> = {
 SERVICE_TYPE:['Какой клининг нужен: поддерживающий или генеральный?','Da li vam treba redovno ili dubinsko čišćenje?','Да ли вам треба редовно или дубинско чишћење?','Do you need regular or deep cleaning?'],
 AREA:['Подскажите, пожалуйста, площадь помещения в м².','Kolika je površina prostora u m²?','Колика је површина простора у м²?','What is the floor area in m²?'],
 SOIL_LEVEL:['Подскажите, пожалуйста, загрязнения обычные или сильные?','Da li je zaprljanost uobičajena ili jaka?','Да ли је запрљаност уобичајена или јака?','Is the dirt level normal or heavy?'],
 EXTRAS:['Нужны ли дополнительные услуги — например, уборка внутри духовки или холодильника?','Da li su potrebne dodatne usluge, na primer čišćenje rerne ili frižidera iznutra?','Да ли су потребне додатне услуге, на пример чишћење рерне или фрижидера изнутра?','Do you need any extras, such as cleaning inside the oven or fridge?'],
 YES_NO:['Проверить свободное время?','Da proverim termine?','Да проверим термине?','Shall I check availability?'],
 POST_BOOKING:['Остались вопросы по записи?','Imate li još pitanja o terminu?','Имате ли још питања о термину?','Do you have any questions about your booking?'],
 BOOKING_CONFIRMATION:['Проверьте детали записи и подтвердите их, пожалуйста.','Proverite i potvrdite detalje termina.','Проверите и потврдите детаље термина.','Please review and confirm the booking details.'],
 SLOT_SELECTION:['Какое из предложенных времён вам подходит?','Koji od ponuđenih termina vam odgovara?','Који од понуђених термина вам одговара?','Which offered time works for you?'],
};
export function inputQuestion(intent:string,locale:string){return questions[intent]?.[Math.max(0,languages.indexOf(locale as AgentLocale))];}
export function inputAlreadyKnown(intent:string,state:AgentState){
 const f=state.draftFacts??state.quote?.input;
 return intent==='SERVICE_TYPE'?!!f?.service:intent==='AREA'?!!f?.area:intent==='SOIL_LEVEL'?!!f?.soilLevel:intent==='EXTRAS'?!!state.draftFacts?.extrasConfirmed||!!state.quote:false;
}
export function createReplySet(state:AgentState,locale:string,revision:number,control:string,now=new Date()):ReplySet|null{
 const intent=state.nextInput;
 if(!intent||control!=='AI_CONTROL'||state.booking&&intent!=='POST_BOOKING'||inputAlreadyKnown(intent,state))return null;
 const keys:ReplyKey[]=intent==='SERVICE_TYPE'?['SERVICE_REGULAR','SERVICE_DEEP','SERVICE_MOVE']:intent==='SOIL_LEVEL'?['SOIL_NORMAL','SOIL_HEAVY']:intent==='EXTRAS'?['NO_EXTRAS']:intent==='YES_NO'?['YES','NO']:intent==='BOOKING_CONFIRMATION'&&state.pending?['CONFIRM_BOOKING']:intent==='POST_BOOKING'&&state.booking?['ASK_QUESTION']:[];
 const choices:QuickReply[]=keys.map(key=>({key,label:replyText(key,locale)}));
 if(intent==='SLOT_SELECTION'&&!state.pending)choices.push(...(state.slots??[]).slice(0,3).map(slot=>({key:`SLOT:${slot.token}`,label:new Intl.DateTimeFormat(locale==='sr-Cyrl'?'sr-RS':locale==='sr-Latn'?'sr-Latn-RS':locale,{timeZone:'Europe/Belgrade',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(slot.start))})));
 if(!choices.length)return null;
 return{id:randomUUID(),intent,choices,conversationRevision:revision,createdAt:now.toISOString(),consumedAt:null,expiresAt:new Date(now.getTime()+10*60000).toISOString()};
}
export function activeReplySet(structured:unknown,revision:number,control:string,now=new Date()):ReplySet|null{
 if(control!=='AI_CONTROL'||!structured||typeof structured!=='object')return null;
 const set=(structured as {replySet?:ReplySet}).replySet;
 if(!set||set.consumedAt||set.conversationRevision!==revision||Date.parse(set.expiresAt)<=now.getTime()||!Array.isArray(set.choices))return null;
 return set;
}
export function replyFacts(key:string):NonNullable<AgentState['draftFacts']>{
 return key==='SOIL_NORMAL'?{soilLevel:'NORMAL'}:key==='SOIL_HEAVY'?{soilLevel:'HEAVY'}:key==='SERVICE_REGULAR'?{service:'regular'}:key==='SERVICE_DEEP'?{service:'deep'}:key==='SERVICE_MOVE'?{service:'move'}:key==='NO_EXTRAS'?{extras:[],extrasConfirmed:true}:{};
}
export function isReplyKey(key: string): key is ReplyKey {
  return Object.hasOwn(replies, key);
}
