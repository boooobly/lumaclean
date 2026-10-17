import type {KnowledgeEntry} from './schema';
export function knowledgeAmounts(entries:KnowledgeEntry[]){
 return [...new Set(entries.flatMap(e=>[...(e.price&&e.price.kind!=='percent'?[e.price.amount]:[]),...e.tariffs.map(t=>t.amount),...[e.description,e.includes,e.excludes,e.restrictions].join(' ').matchAll(/(\d[\d ]*)\s*RSD/gu)].map(v=>typeof v==='number'?v:Number(v[1].replace(/ /g,'')))))];
}
export function knowledgeTimeExplanation(sentence:string,entries:KnowledgeEntry[]){
 if(/(?:можем приехать|приедем|записал|available at|we can come|dolazimo|долазимо|slobodan termin|слободан термин)/iu.test(sentence))return false;
 if(/12\s*(?:час|hour|sat|сат)/iu.test(sentence))return entries.some(e=>e.code==='RULE-PAY-011')&&/замечан|недостат|обращен|претенз|report|defect|complaint|reklam|реклам|пријав|prijav/iu.test(sentence);
 if(/30\s*(?:мин|minute|minut|минут)/iu.test(sentence))return entries.some(e=>e.runtimeCode==='ironing')&&/глаж|ironing|pegl|пегл/iu.test(sentence);
 if(/24\s*(?:час|hour|sat|сат)/iu.test(sentence))return entries.some(e=>e.code==='RULE-HOURS-009')&&/рекоменд|recommend|preporuč|preporuc|препоруч/iu.test(sentence);
 const times=sentence.match(/\b\d{1,2}:\d{2}\b/gu)??[];
 if(times.length)return entries.some(e=>e.code.startsWith('RULE-HOURS-')||e.code==='RULE-URGENCY-001')&&times.every(t=>['09:00','17:00','22:00'].includes(t))&&/заяв|работ|выезд|порог|после|до |hours|request|cutoff|depart|radn|prijav|polas|радн|пријав|полас/iu.test(sentence);
 return false;
}
export function unsupportedKnowledgeClaim(text:string,entries:KnowledgeEntry[],hasQuote:boolean){
 if(/себестоим|маржиналь|зарплат|выплат.{0,12}клинер|profit margin|cleaner payout|cost of supplies|troškovi poslovanja/iu.test(text))return true;
 if(!hasQuote&&/(?:итого|итоговая (?:цена|стоимость)|всего к оплате|order total|total (?:cost|price|is)|ukupno za (?:sve|narudžbinu)|укупно за све)\D{0,30}\d[\d ,.]*\s*(?:RSD|динар|dinara)/iu.test(text))return true;
 const bindings:[RegExp,string][]=[[/холодиль|fridge|refrigerator|frižider|frizider|фрижидер/iu,'fridge'],[/духов|oven|rerna|рерн/iu,'oven'],[/свч|микроволн|microwave|mikrotalas|микроталас/iu,'microwave'],[/вытяж|extractor hood|aspirator|аспиратор/iu,'hood'],[/посудомо|dishwasher|sudov|судов/iu,'dishwasher'],[/стиральн|washing machine|veš mašin|ves masin|веш машин/iu,'washingMachine']];
 for(const clause of text.split(/[;\n]|,(?!\d)/u)){
  const amounts=[...clause.matchAll(/(\d[\d\s.,]*?)\s*(?:RSD|динар(?:ов|а)?|дин\.?|dinara|din\.?)/giu)].map(m=>Number(m[1].replace(/[\s,.]/g,'')));
  if(amounts.length!==1)continue;
  const codes=bindings.filter(([pattern])=>pattern.test(clause)).map(([,code])=>code);
  if(codes.length===1){const e=entries.find(e=>e.runtimeCode===codes[0]);if(e?.price&&amounts[0]!==e.price.amount&&!hasQuote)return true;}
  if(!hasQuote&&amounts.length===1){
   const sizes:[RegExp,string][]=[[/тр[её]хмест|three.seat|trosed|тросед/iu,'UPH-SOFA-002'],[/двухмест|two.seat|dvosed|двосед/iu,'UPH-SOFA-001'],[/углов|corner sofa|ugaon|угаон/iu,'UPH-SOFA-004']];
   for(const [pattern,code] of sizes){const e=entries.find(e=>e.code===code);if(e?.price&&pattern.test(clause)&&!/дополн|сверх|extra|additional|preko|dodat|додат/iu.test(clause)&&amounts[0]!==e.price.amount)return true;}
   if(amounts[0]===5600&&/за.{0,15}(?:место|seat|mesto)|per seat/iu.test(clause)&&entries.some(e=>e.code==='UPH-SOFA-004'))return true;
  }
  if(/900\s*RSD/iu.test(clause)&&/глаж|ironing|pegl|пегл/iu.test(clause)&&/(?:за|per|po|по)\s*(?:один\s*|1\s*)?(?:час|hour|sat|сат)/iu.test(clause))return true;
 }
 for(const e of entries){
  if(e.status!=='UNAVAILABLE')continue;
  if(/(?:выполним|оказываем|можем (?:сделать|убрать|почистить)|we (?:offer|can clean|provide)|radimo|nudimo|радимо|нудимо)/iu.test(text)&&!/не (?:выполняем|оказываем|делаем|предоставляем)|не можем|do not|don't|cannot|not offer|ne radimo|ne nudimo|не радимо|не нудимо/iu.test(text))return true;
 }
 return false;
}
