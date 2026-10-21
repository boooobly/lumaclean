import type {AgentState} from './contracts';
import {applianceCodes,type ApplianceCode} from '@/lib/appliance-catalog';
import {normalizeCustomerText} from './customer-text';
type Facts=NonNullable<AgentState['draftFacts']>;
const patterns:Record<ApplianceCode,RegExp>={
 fridge:/холодильник[а-яё]*|фрижидер[а-я]*|fri[zž]ider[a-z]*|fridges?|refrigerators?/giu,
 oven:/духовк[а-яё]*|рерн[а-я]*|rern[a-z]*|ovens?/giu,
 microwave:/микроволн[а-яё]*|(?<!\p{L})свч(?!\p{L})|микроталасн[а-я]*|mikrotalasn[a-z]*|microwaves?/giu,
 hood:/вытяжк[а-яё]*|аспиратор[а-я]*|aspirator[a-z]*|(?:extractor |cooker |range )?hoods?/giu,
 dishwasher:/посудомо[а-яё]*|машин[а-я]* за судове|masin[a-z]* za sudov[a-z]*|dishwashers?/giu,
 washingMachine:/стиральн[а-яё]*(?: машин[а-яё]*)?|машин[а-я]* за веш|masin[a-z]* za ves|washing machines?|washers?/giu,
};
for(const code of applianceCodes)patterns[code]=new RegExp('(?<!\\p{L})(?:'+patterns[code].source+')(?!\\p{L})',patterns[code].flags);
const numbers:Record<string,number>={один:1,одна:1,одно:1,одну:1,два:2,две:2,двух:2,три:3,трех:3,четыре:4,пять:5,шесть:6,семь:7,восемь:8,девять:9,десять:10,jedan:1,jedna:1,jedno:1,dva:2,dve:2,tri:3,cetiri:4,pet:5,sest:6,sedam:7,osam:8,devet:9,deset:10,један:1,једна:1,четири:4,пет:5,шест:6,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
const inside=/внутр[а-яё]*|изнутр[а-яё]*|iznutra|unutra|unutrasnj[a-z]*|изнутра|унутра|inside|interior/iu;
const outside=/снаружи|внешн[а-яё]*|spolja|spoljasnj[a-z]*|споља|outside|exterior/iu;
const uncertain=/возможно|наверно|не уверен|думаю|может быть|mozda|verovatno|nisam sigur|можда|вероватно|probably|maybe|not sure/iu;
const request=/нуж[а-яё]*|помы[а-яё]*|помой[а-яё]*|почист[а-яё]*|добав[а-яё]*|убер[а-яё]*|убрат[а-яё]*|остав[а-яё]*|treba|zelim|dodaj|ukloni|ostav|треба|желим|додај|остав|need|want|clean|wash|add|remove|keep|as well|тоже|ещ[её]/iu;
const question=/^(?:можно|а .{0,25}можно|вы |что |как |сколько |есть |can |do you|what |how |da li|mogu li|mozete li|да ли|могу ли|можете ли)/iu;
const no=/(?:^|[^\p{L}])(?:без|не (?:надо|нуж[а-яё]*|мой|мыть|добав|чист)|убер[а-яё]*|убрат[а-яё]*|bez|ne treba|ukloni|without|don't|do not|remove|no )/iu;
const yes=/^(?:да|yes|da|да)[,!.\s]*(?:добав[а-яё]*|please|molim|пожалуйста)?[!.\s]*$/iu;
const bareNo=/^(?:нет|не|не надо|не нужно|no(?: thanks)?|none|ne(?: treba)?|не треба)[.!\s]*$/iu;
const normalized=normalizeCustomerText;
function quantity(prefix:string){
 const tokens=prefix.trim().split(/[^\p{L}\p{N}]+/u).filter(Boolean);
 const last=tokens.at(-1)??'';
 return /^\d{1,3}$/u.test(last)?Number(last):numbers[last]??1;
}
export function mentionedAppliances(text:string){const t=normalized(text);return applianceCodes.filter(code=>[...t.matchAll(patterns[code])].length>0);}
/** All mentioned entities are collected; scope and uncertainty remain separate from confirmed facts. */
export function applianceFacts(text:string,expected:AgentState['nextInput'],state?:AgentState):Facts{
 const t=normalized(text),facts:Facts={};
 if(/(?:^|\s)(?:без|without|bez)\s/iu.test(t)&&/\?|how much|сколько|koliko|колико/iu.test(t)&&!/уберите|убрать|не надо|remove|exclude|ukloni|уклони|отмен/iu.test(t))return facts;
 const pending=state?.draftFacts?.applianceScopePending??[];
 const scope=state?.questionContext?.status==='OPEN'&&state.questionContext.scope==='appliance_inside'||expected==='EXTRAS';
 if(expected==='APPLIANCE_SCOPE'&&pending.length&&(yes.test(t)||/^(?:да[,\s]*)?(?:изнутри|внутри|inside|iznutra|изнутра)[.!\s]*$/iu.test(t))){return{extras:pending,extrasConfirmed:true,applianceScopePending:[]};}
 if(expected==='APPLIANCE_SCOPE'&&pending.length&&(bareNo.test(t)||outside.test(t))){return{declinedExtras:pending.map(e=>e.code),extrasConfirmed:true,applianceScopePending:[]};}
 if(expected==='EXTRAS'&&bareNo.test(t))return{extras:[],extrasConfirmed:true};
 if(uncertain.test(t)||/(?:^|\s)(?:или|or|ili)(?:\s|$)/iu.test(t)||question.test(t)&&!/хочу|мне нужно|treba mi|zelim|i need|i want/iu.test(t))return facts;
 const mentions=applianceCodes.flatMap(code=>[...t.matchAll(patterns[code])].map(m=>({code,start:m.index!,end:m.index!+m[0].length}))).sort((a,b)=>a.start-b.start);
 const both=/оба|обе|обо[иё]х|both|oba|obe|обе/iu.test(t);
 if(!mentions.length&&both&&scope){
  const offered=state?.questionContext?.offeredCodes??['oven','fridge'];
  if(offered.length===2)return{extras:offered.map(code=>({code,quantity:1})),extrasConfirmed:true};
 }
 if(!mentions.length)return facts;
 if(!scope&&!inside.test(t)&&!request.test(t)&&!no.test(t)&&!expected)return facts; // Mere catalog mention is not consent.
 const extras=new Map<ApplianceCode,number>(),declined=new Set<ApplianceCode>(),unconfirmed=new Map<ApplianceCode,number>();
 for(const [i,m] of mentions.entries()){
  const before=t.slice(i?mentions[i-1].end:0,m.start);
  const after=t.slice(m.end,mentions[i+1]?.start??t.length);
  const prefix=before.split(/[,.;!?\n]|\b(?:and|i)\b|\sи\s|\sа\s/iu).at(-1)??before;
  const suffix=after.split(/[,.;!?\n]|\b(?:and|i)\b|\sи\s|\sа\s/iu)[0];
  const local=prefix+' '+t.slice(m.start,m.end)+' '+suffix;
  const keep=/остав[а-яё]*|ostav|остав|keep/iu.test(local);
  if(!keep&&(no.test(local)||outside.test(local))){declined.add(m.code);continue;}
  const prefixLast=prefix.trim().split(/[^\p{L}\p{N}]+/u).at(-1)??'';
  const afterFirst=suffix.trim().split(/[^\p{L}\p{N}]+/u)[0]??'';
  const hasPrefix=/^\d+$/u.test(prefixLast)||numbers[prefixLast]!==undefined;
  const hasSuffix=(i===mentions.length-1||/[,.]|\s(?:и|а|and|i)\s/iu.test(after))&&(/^\d+$/u.test(afterFirst)||numbers[afterFirst]!==undefined);
  const old=state?.draftFacts?.extras?.find(e=>e.code===m.code);
  const more=/ещ[её]|дополнительно|jos|још|another|more/iu.test(prefix);
  const q=more?(old?.quantity??0)+(hasPrefix?quantity(prefix):hasSuffix?quantity(afterFirst):1):!hasPrefix&&hasSuffix?quantity(afterFirst):!hasPrefix&&!hasSuffix&&old?old.quantity:quantity(prefix);
  if(q<1||q>100)continue;
  if(scope||inside.test(local)||inside.test(t)&&!outside.test(t)||!!state?.draftFacts?.extras?.some(e=>e.code===m.code))extras.set(m.code,q);
  else unconfirmed.set(m.code,q);
 }
 if(extras.size){facts.extras=[...extras].map(([code,q])=>({code,quantity:q}));facts.extrasConfirmed=true;}
 if(declined.size){facts.declinedExtras=[...declined];facts.extrasConfirmed=true;}
 if(unconfirmed.size)facts.applianceScopePending=[...unconfirmed].map(([code,q])=>({code,quantity:q}));
 if(pending.length&&!unconfirmed.size&&(extras.size||declined.size))facts.applianceScopePending=pending.filter(e=>!extras.has(e.code)&&!declined.has(e.code));
 return facts;
}
