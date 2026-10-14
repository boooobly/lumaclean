import {z} from 'zod';
import {customerFactsSchema,proposalFields,fieldEvidenceSchema,type AgentState} from './contracts';
import {businessLabels} from './business-labels';

type Facts=NonNullable<AgentState['draftFacts']>;
const words:Record<string,number>={один:1,одна:1,одно:1,два:2,две:2,три:3,четыре:4,пять:5,шесть:6,један:1,једна:1,четири:4,пет:5,шест:6,jedan:1,jedna:1,dva:2,dve:2,tri:3,cetiri:4,pet:5,sest:6,one:1,two:2,three:3,four:4,five:5,six:6};
function numbers(text:string){const tokens=text.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().match(/[\p{L}]+|[-+]?\d+(?:[.,]\d+)?/gu)??[];return tokens.flatMap(t=>/^[-+]?\d/u.test(t)?[Number(t.replace(',','.'))]:words[t]?[words[t]]:[]);}
/** Unsupported semantics become a customer-confirmed proposal, never a silent CRM write. */
export function supportedProposal(facts:Facts,source:string,fields:z.infer<typeof fieldEvidenceSchema>){
 const keys=Object.keys(facts).filter(k=>k!=='extrasConfirmed');
 if(!keys.length||keys.some(k=>!(proposalFields as readonly string[]).includes(k))||keys.some(k=>fields.filter(e=>e.field===k&&source.includes(e.evidence)).length!==1))return false;
 if(fields.some(e=>!keys.includes(e.field)||!source.includes(e.evidence)))return false;
 for(const key of keys){
  const evidence=fields.find(e=>e.field===key)!.evidence,available=numbers(evidence);
  if(['area','bathroomCount','requestedCrew'].includes(key)&&!available.includes(Number(facts[key as keyof Facts])))return false;
  if(key==='area'){
   const start=source.indexOf(evidence),before=source.slice(Math.max(0,start-20),start),after=source.slice(start+evidence.length,start+evidence.length+15);
   if(/\bRSD\b|динар|dinar|стоим|цена|price|cost/iu.test(evidence)||/^\s*(?:RSD|динар|dinara|dinar)\b/iu.test(after)||/(?:цена|стоимость|price|cost)\s*[:=]?\s*$/iu.test(before))return false;
  }
  if(key==='extras'&&(!(facts.extras?.length)||(facts.extras??[]).some(e=>e.quantity!==1&&!available.includes(e.quantity))))return false;
  if(key==='windowCleaning'&&Object.entries(facts.windowCleaning??{}).some(([k,v])=>k.endsWith('Count')&&v!==0&&!available.includes(Number(v))))return false;
  if(key==='requestedDate'&&!source.includes(facts.requestedDate!))return false;
 }
 return true;
}
export function proposalQuestion(facts:Facts,locale:string){
 const sr=locale.startsWith('sr'),en=locale==='en',cyrl=locale==='sr-Cyrl';
 const labels=businessLabels(locale);
 const service=cyrl?{regular:'одржавајуће чишћење',deep:'генерално чишћење',move:'чишћење при селидби',airbnb:'Airbnb',office:'чишћење канцеларије'}:sr?{regular:'održavajuće čišćenje',deep:'generalno čišćenje',move:'čišćenje pri selidbi',airbnb:'Airbnb',office:'čišćenje kancelarije'}:en?{regular:'regular cleaning',deep:'deep cleaning',move:'move cleaning',airbnb:'Airbnb',office:'office cleaning'}:{regular:'поддерживающая уборка',deep:'генеральная уборка',move:'уборка при переезде',airbnb:'Airbnb',office:'уборка офиса'};
 const parts:string[]=[];
 if(facts.service)parts.push(service[facts.service]);
 if(facts.area)parts.push(facts.area+' m²');
 if(facts.soilLevel)parts.push((cyrl?'запрљаност':sr?'zaprljanost':en?'dirt':'загрязнение')+': '+({LIGHT:cyrl?'лака':sr?'laka':en?'light':'лёгкое',NORMAL:cyrl?'уобичајена':sr?'uobičajena':en?'normal':'обычное',HEAVY:cyrl?'јака':sr?'jaka':en?'heavy':'сильное',EXTREME:cyrl?'екстремна':sr?'ekstremna':en?'extreme':'экстремальное'}[facts.soilLevel]));
 if(facts.extras)parts.push(...facts.extras.map(e=>e.quantity+' × '+(labels[e.code as keyof typeof labels]??e.code)));
 if(facts.bathroomCount!==undefined)parts.push((cyrl?'купатила':sr?'kupatila':en?'bathrooms':'санузлы')+': '+facts.bathroomCount);
 if(facts.requestedCrew)parts.push((cyrl?'особе':sr?'osobe':en?'cleaners':'клинеры')+': '+facts.requestedCrew);
 if(facts.requestedDate)parts.push(facts.requestedDate);
 if(facts.windowCleaning)parts.push((cyrl?'прозори':sr?'prozori':en?'windows':'окна')+': '+[facts.windowCleaning.standardCount!==undefined?(cyrl?'стандардни':sr?'standardni':en?'standard':'стандартные')+' '+facts.windowCleaning.standardCount:'',facts.windowCleaning.largeCount!==undefined?(cyrl?'велики':sr?'veliki':en?'large':'большие')+' '+facts.windowCleaning.largeCount:'',facts.windowCleaning.totalCount!==undefined?String(facts.windowCleaning.totalCount):''].filter(Boolean).join(', '));
 return (cyrl?'Да ли сам добро разумела: ':sr?'Da li sam dobro razumela: ':en?'Have I understood correctly: ':'Правильно поняла: ')+parts.join('; ')+'?';
}
export function confirmedProposal(text:string,state:AgentState):Facts|undefined{
 const p=state.pendingFactProposal,q=state.questionContext;
 if(!p||q?.questionKey!=='FACT_CONFIRMATION'||q.status!=='OPEN')return;
 if(/^(?:да|yes|da|да)[,.!\s]*(?:верно|все верно|всё верно|correct|tacno|tačno|тачно)?[.!\s]*$/iu.test(text.trim())){
  const facts=customerFactsSchema.parse(p.facts);delete state.pendingFactProposal;
  if(facts.extras)facts.extrasConfirmed=true;
  return facts;
 }
 if(/^(?:нет|no|ne|не)[.!\s]*$/iu.test(text.trim()))delete state.pendingFactProposal;
}
