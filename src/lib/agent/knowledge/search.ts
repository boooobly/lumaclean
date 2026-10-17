import raw from './snapshot.json';
import {knowledgeSnapshotSchema,knowledgeQuerySchema,knowledgeResultSchema,type KnowledgeEntry} from './schema';
import {normalizeKnowledge,topics} from './vocabulary';
import {extrasPrices,priceMatrix} from '@/lib/pricing';
import {upholsteryDefaults} from '@/lib/upholstery';

export const businessKnowledge=knowledgeSnapshotSchema.parse(raw);
export const businessKnowledgeEnabled=()=>process.env.AGENT_BUSINESS_KNOWLEDGE_ENABLED!=='false';
const stop=new Set(['a','the','is','do','you','of','and','in','to','can','i','mi','da','li','je','u','za','na','i','что','это','ли','в','и','а','можно','сколько','как','у','вы','мне','не','мы']);
function words(s:string){return normalizeKnowledge(s).split(' ').filter(w=>w.length>2&&!stop.has(w));}
const indexed=businessKnowledge.entries.map(entry=>({entry,name:normalizeKnowledge(entry.name),aliases:entry.aliases.map(normalizeKnowledge),words:words([entry.name,...entry.aliases,entry.description].join(' '))}));
export function knowledgeConsistency(){
 const errors:string[]=[];
 for(const e of businessKnowledge.entries){
  if(e.runtimeCode&&e.category==='extra'&&e.price?.amount!==extrasPrices[e.runtimeCode as keyof typeof extrasPrices])errors.push(e.code);
  if(e.category==='cleaning'&&(e.price?.amount!==priceMatrix[e.runtimeCode as keyof typeof priceMatrix]?.[0]||e.tariffs.some((t,i)=>t.amount!==priceMatrix[e.runtimeCode as keyof typeof priceMatrix]?.[i])))errors.push(e.code);
 }
 const upholstered:Record<string,number>={'UPH-SOFA-001':upholsteryDefaults.sofa2,'UPH-SOFA-002':upholsteryDefaults.sofa3Normal,'UPH-CHAIR-001':upholsteryDefaults.armchair,'UPH-CHAIR-007':upholsteryDefaults.chair,'UPH-SOFA-006':upholsteryDefaults.cornerSeat,'UPH-SPOT-001':upholsteryDefaults.spot,'UPH-RULE-001':upholsteryDefaults.minimumVisit};
 for(const [code,amount] of Object.entries(upholstered))if(businessKnowledge.entries.find(e=>e.code===code)?.price?.amount!==amount)errors.push(code);
 return{ok:!errors.length,errors};
}
const resultCache=new Map<string,{at:number;result:ReturnType<typeof lookup>}>();
export function searchBusinessKnowledge(input:unknown){
 if(!businessKnowledgeEnabled()){knowledgeQuerySchema.parse(input);return knowledgeResultSchema.parse({version:businessKnowledge.version+':disabled',matches:[],truncated:false,orderTotals:'calculatePrice only',availability:'slot tools only'});}
 const parsed=knowledgeQuerySchema.parse(input),key=businessKnowledge.version+':'+normalizeKnowledge(parsed.query)+':'+(parsed.limit??4);
 const saved=resultCache.get(key);if(saved&&Date.now()-saved.at<600000)return structuredClone(saved.result);
 const result=lookup(parsed);if(resultCache.size>=64)resultCache.delete(resultCache.keys().next().value!);resultCache.set(key,{at:Date.now(),result});return structuredClone(result);
}
function lookup(input:unknown){
 const {query,limit=4}=knowledgeQuerySchema.parse(input),q=normalizeKnowledge(query),tokens=words(query);
 const codeQuery=/^(?:PACKAGE|ADD|UPH|SCOPE|RULE)-[A-Z0-9-]+$/iu.test(query);
 const queryTopics=topics.filter(([r])=>r.test(query)).map(([,a])=>a.map(normalizeKnowledge));
 const selected=indexed.map(({entry,name,aliases,words:terms})=>{
  if(codeQuery)return{entry,score:entry.code===query.toUpperCase()?1000:0};
  let score=tokens.reduce((sum,w)=>sum+(terms.some(t=>t===w)?3:terms.some(t=>w.length>3&&t.length>3&&(t.startsWith(w.slice(0,-1))||w.startsWith(t.slice(0,-1))))?2:0),0);
  if(q===normalizeKnowledge(entry.code))score+=1000;
  const phrase=aliases.filter(a=>a.length>=4&&q.includes(a)).reduce((n,a)=>Math.max(n,a.length),0);
  score+=phrase*2+(q.includes(name)?30:0);
  score+=queryTopics.reduce((n,t)=>n+(t.some(a=>aliases.includes(a))?5:0),0);
  if(entry.category==='scope')score-=3;
  if(entry.runtimeCode&&score>0)score+=8;
  if(entry.category==='upholstery'&&/trosed|тросед|тр[её]хмест|three.seat|3.seat/iu.test(query))score+=entry.code==='UPH-SOFA-002'?30:-15;
  if(entry.category==='upholstery'&&/dvosed|двосед|двухмест|two.seat|2.seat/iu.test(query))score+=entry.code==='UPH-SOFA-001'?30:-15;
  if(entry.category==='upholstery'&&/углов|corner|ugaon|угаон/iu.test(query))score+=entry.code==='UPH-SOFA-004'?30:-15;
  if(entry.category==='cleaning'&&/входит|состав|отлич|includ|difference|ulazi|uključ|ukljuc|укључ|разлик|obuhvata/iu.test(query))score+=6;
  if(/оплат|payment|platim|plać|плаћ/iu.test(query)&&entry.code.startsWith('RULE-PAY-00'))score+=5;
  if(entry.code==='RULE-GENERAL-009'&&/сануз|bathroom|kupatil|купатил/iu.test(query))score+=14;
  if(entry.code==='UPH-RULE-001'&&/миним|minimum|minimal/iu.test(query))score+=25;
  if(entry.code==='RULE-PAY-015'&&/ремонт|renovat|renovir|реновир/iu.test(query))score+=25;
  if(entry.code==='RULE-PAY-014'&&/плесен|плесень|mold|mould|buđ|budj|буђ/iu.test(query))score+=25;
  if(entry.code==='RULE-PAY-005'&&/карт|card|kartic|картиц/iu.test(query))score+=25;
  if(entry.code==='RULE-LOYALTY-011'&&/скид|discount|popust|попуст|регулярн|regular customer|redovn|редовн/iu.test(query))score+=25;
  if(entry.code==='RULE-URGENCY-001'&&/сегодня|срочн|today|urgent|danas|hitno|данас|хитно/iu.test(query))score+=25;
  if(entry.code==='RULE-PAY-011'&&/недостат|претенз|замечан|reklamac|рекламац|defect|quality|complaint/iu.test(query))score+=20;
  if(entry.code==='RULE-TRAVEL-001'&&/район|Белград|district|Belgrade|Beograd|Београд|service area/iu.test(query))score+=20;
  if(entry.code==='ADD-WINDOW-017'&&/ролет|роллет|rolet|shutter|рольстав/iu.test(query))score+=25;
  if(entry.code==='ADD-WINDOW-016'&&/москит|mosquito|komarnik|комарник/iu.test(query))score+=25;
  if(entry.code==='ADD-TEXTILE-001'&&/стирк|laundry|pranje ve[šs]a|прање веша/iu.test(query))score+=20;
  if(entry.code==='RULE-CREW-015'&&/оборуд|пылесос|equipment|Kärcher|Karcher|oprem|usisiva|опрем|усисива/iu.test(query))score+=30;
  if(entry.code==='RULE-TRAVEL-008'&&/средств|расходник|supplies|detergent|sredstv|средств/iu.test(query))score+=25;
  if(entry.code==='RULE-PAY-016'&&/гарант|все пятн|всех пятен|all stains|guarantee|garant|sve mrlj|sve flek|све мрљ|све флек|материал|fabric|material|материјал/iu.test(query))score+=30;
  // The standard generic item outranks office/rental variants; context may select those explicitly.
  if(entry.code.startsWith('ADD-OFFICE')&&!/офис|office|kancelar|канцелар/iu.test(query))score-=10;
  if(entry.code.startsWith('ADD-AIRBNB')&&!/airbnb|гост|guest/iu.test(query))score-=10;
  return{entry,score};
 }).filter(x=>x.score>=7).sort((a,b)=>b.score-a.score||a.entry.code.localeCompare(b.entry.code));
 const matches:KnowledgeEntry[]=[];let size=0;
 const consistency=knowledgeConsistency();
 for(const {entry} of selected){if(matches.length>=limit)break;if(consistency.errors.includes(entry.code))continue;
  // Aliases belong to the index; the model receives only relevant facts, never the index itself.
  const compact={...entry,aliases:[]};const length=JSON.stringify(compact).length;
  if(size+length>6500)continue;matches.push(compact);size+=length;
 }
 return knowledgeResultSchema.parse({version:businessKnowledge.version,matches,truncated:selected.length>matches.length,orderTotals:'calculatePrice only',availability:'slot tools only'});
}

/** A direct business question interrupts qualification, including a mixed facts + question turn. */
export function catalogConsultationRequest(text:string){
 if(!/(?:хочу|нужн|добав|помой|почист|отмыть|есть.{0,20}ролет|treba|želim|zelim|треба|желим|i need|i want|please|add)/iu.test(text))return false;
 const first=searchBusinessKnowledge({query:text.slice(0,400),limit:1}).matches[0];
 const standalone=/только|only|samo|само/iu.test(text);
 return !!first&&(first.category==='upholstery'||first.category==='extra'&&(!first.autoCalculate||standalone&&first.standalone==='BY_AGREEMENT'));
}
export function directBusinessQuestion(text:string){
 const question=/\?|(?:^|[.!]\s*|\sа\s)(?:что|чем|как|какие|входит|входят|можно|моете|чистите|делаете|сколько стоит|what|how|do you|does|can i|is|are|da li|šta|sta|kako|koliko|да ли|шта|како|колико)(?=\s|$|[?!.,:])/iu.test(text);
 if(!question)return false;
 if(/сколько.{0,30}(?:всего|всё|вместе)|итого|how much.{0,20}(?:all|total|both|together)|koliko.{0,20}(?:sve|ukupno)|колико.{0,20}(?:све|укупно)/iu.test(text))return false;
 if(/сколько.{0,50}(?:вс[её]|стоить|вместе)|итого|how much.{0,30}(?:all|total|both|together)|koliko.{0,30}(?:sve|ukupno)/iu.test(text)&&/(?:хочу|мне нуж|нам нуж|treba mi|желим|треба ми|i need|i want|please clean)/iu.test(text)&&!/входит|входят|includ|uključ|ukljuc|укључ/iu.test(text))return false;
 // Personalized total remains the server quote path. Unit-price questions stay knowledge questions.
 if(/сколько(?:.{0,25}(?:вс[её]|будет|итого))?|стоим|цен|price|cost|итого|how much|total|koliko.{0,30}(?:sve|ukupno)|колико.{0,30}(?:све|укупно)/iu.test(text)&&/\d+\s*(?:м²|m²|квадрат|kvadrat|square)|\b(?:уборка|cleaning|čišćenje|чишћење)\b.{0,15}\d+/iu.test(text)&&!/входит|входят|includ|uključ|ukljuc|укључ/iu.test(text))return false;
 return searchBusinessKnowledge({query:text.slice(0,400),limit:1}).matches.length>0;
}
