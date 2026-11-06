import type {AgentLocale} from './contracts';
import type {AgentMessage} from './providers';
import {directBusinessQuestion} from './knowledge/search';

/** Messages are ordered under the conversation lock, including equal ingress times. */
export function nextMessageTime(receivedAt:Date,previous?:Date){
  return new Date(Math.max(receivedAt.getTime(),previous?previous.getTime()+1:0));
}

/** Ordering can advance sentAt across midnight; customer-relative dates cannot. */
export function messageReceivedTime(message:{receivedAt?:Date|null;sentAt:Date}){
  return message.receivedAt??message.sentAt;
}

/** Keep independent questions out of the single-purpose deterministic intake shortcut. */
export function turnNeedsModel(turn:readonly {text:string}[]){
  const text=turn.map(m=>m.text).join('\n');
  if((text.match(/\?/g)?.length??0)>1)return true;
  return turn.flatMap(m=>m.text.split(/(?<=[.!?])\s+|\n/u)).some(part=>directBusinessQuestion(part))&&!directBusinessQuestion(text);
}

export function turnMessages(turn:readonly {text:string}[]):AgentMessage[]{
  return turn.map(m=>({role:'user',content:m.text}));
}

const greetings:Record<AgentLocale,string>={ru:'Здравствуйте!','sr-Latn':'Zdravo!','sr-Cyrl':'Здраво!',en:'Hello!'};
const leadingGreeting=/^(?:(?:здравствуйте|здравствуй|добрый\s+(?:день|вечер)|доброе\s+утро|привет|hello|hi|hey|good\s+(?:morning|afternoon|evening)|zdravo|dobar\s+(?:dan|veče)|dobro\s+jutro|здраво|добар\s+(?:дан|вече)|добро\s+јутро)(?![\p{L}\p{N}])[!.,:\s]*)+/iu;

/** Applied at persistence, so shortcuts, model fallback and retries share one rule. */
export function responseGreeting(text:string,locale:AgentLocale,firstReply:boolean){
  const body=text.trim().replace(leadingGreeting,'').trim();
  return firstReply?`${greetings[locale]??greetings.ru}${body?' '+body:''}`:body||text.trim();
}
