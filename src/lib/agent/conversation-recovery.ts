import type {AgentState} from './contracts';
import {customerFactsSchema} from './contracts';
import {applyCustomerFacts,explicitCustomerFacts} from './customer-facts';
type FactKey=keyof NonNullable<AgentState['draftFacts']>;
type Source={text:string;sentAt:Date;structured:unknown};
/** Restore only missing operational fields. Already known/typed facts are never replayed away. */
export function recoverMissingFacts(state:AgentState,sources:Source[],timezone:string,currentLocalDate:string){
 const original=state.draftFacts??{},missing=new Set<FactKey>(['service','area','soilLevel','bathroomCount','windowCleaning'].filter(key=>original[key as FactKey]===undefined) as FactKey[]);
 if(!original.extrasConfirmed){missing.add('extras');missing.add('extrasConfirmed');missing.add('declinedExtras');missing.add('applianceScopePending');}
 const changed=new Set<string>();
 for(const m of sources.slice(-16)){
  const metadata=m.structured as {inputIntent?:AgentState['nextInput'];factExtraction?:{accepted?:unknown}}|null;
  const snapshot=customerFactsSchema.safeParse(metadata?.factExtraction?.accepted);
  const parsed={...explicitCustomerFacts(m.text,m.sentAt,timezone,metadata?.inputIntent,state),...(snapshot.success?snapshot.data:{})};
  const repair=Object.fromEntries(Object.entries(parsed).filter(([key])=>missing.has(key as FactKey)));
  if(Object.keys(repair).length&&applyCustomerFacts(state,repair,currentLocalDate))Object.keys(repair).forEach(key=>changed.add(key));
 }
 return [...changed];
}
export function loopClarificationText(key:string,locale:string){
 const texts:Record<string,string[]>={
  EXTRAS:['Я не смогла определить конкретные дополнительные услуги из ответа. Назовите нужные позиции; если всё уже перечислено, напишите «больше ничего».','Nisam uspela da odredim konkretne dodatne usluge. Navedite koje želite; ako ste već sve naveli, napišite „ništa više“.','Нисам успела да одредим конкретне додатне услуге. Наведите које желите; ако сте већ све навели, напишите „ништа више“.','I could not identify the specific extras. Name the ones you want; if you have already listed everything, say “nothing else”.'],
  AREA:['Для расчёта не хватает числовой площади. Напишите одно значение в м².','Za obračun nedostaje brojčana površina. Napišite jednu vrednost u m².','За обрачун недостаје бројчана површина. Напишите једну вредност у м².','The quote needs a numeric floor area. Send one value in m².'],
  SOIL_LEVEL:['Не удалось однозначно определить загрязнение квартиры. Уточните только это: обычное или сильное.','Nisam mogla jasno da odredim zaprljanost stana. Potvrdite samo to: uobičajena ili jaka.','Нисам могла јасно да одредим запрљаност стана. Потврдите само то: уобичајена или јака.','I could not determine the apartment’s dirt level. Confirm just this: normal or heavy.'],
  WINDOW_COUNTS:['Количество окон пока не определено. Напишите отдельно число стандартных и больших окон.','Broj prozora nije određen. Napišite odvojeno broj standardnih i velikih.','Број прозора није одређен. Напишите одвојено број стандардних и великих.','The window counts are unclear. Send the number of standard and large windows separately.'],
  WINDOW_TYPE:['Количество окон сохранено, но их размер не определён. Это стандартные или большие окна?','Broj prozora je sačuvan, ali veličina nije određena. Da li su standardni ili veliki?','Број прозора је сачуван, али величина није одређена. Да ли су стандардни или велики?','The window count is saved, but their size is unclear. Are they standard or large?'],
 };
 return texts[key]?.[{ru:0,'sr-Latn':1,'sr-Cyrl':2,en:3}[locale]??0];
}
