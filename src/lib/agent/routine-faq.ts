import type {AgentLocale,ToolName,ToolResult} from './contracts';
import {mandatoryHandoff,substantiveIntent} from './policy';
import {mentionedAppliances} from './appliance-facts';
import {formatRsd} from '@/lib/pricing';
import {alternativePriceRequest} from './alternative-price';
import {quoteText} from './conversion-intake';
import type {AgentState} from './contracts';
/** Narrow FAQs with fully known catalog status. No invented operational process. */
export async function routineFaq(text:string,locale:AgentLocale,tool:(name:ToolName,args:unknown)=>Promise<ToolResult>){
 const exclude=alternativePriceRequest(text);
 if(exclude){const result=await tool('calculateAlternativePrice',{exclude,evidence:text});if(result.error)return;const q=result.quote as AgentState['quote'];return ({ru:'Вариант без названной техники; выбранные услуги не изменены.','sr-Latn':'Varijanta bez navedenih uređaja; izabrane usluge nisu promenjene.','sr-Cyrl':'Варијанта без наведених уређаја; изабране услуге нису промењене.',en:'An option without the named appliances; your selected services have not changed.'}[locale])+'\n'+quoteText({quote:q},locale);}
 text=text.replace(/^(?:ответьте|ответь|пишите|говорите)\s+на\s+(?:русском|английском|сербском|српском)\s*[:—,-]\s*|^(?:in english(?: please)?|na srpskom(?:, molim)?|на српском)\s*[:—,-]\s*/iu,'');
 if(mandatoryHandoff(text)||substantiveIntent(text)||(text.match(/\?/g)?.length??0)>1||!/\?|^(?:как|есть|какие|можно|how|what|do you|can i|kako|koliko|da li|mogu li|како|да ли|могу ли)/iu.test(text.trim()))return;
 const payment=/оплат|картой|payment|pay by card|kartic|plać|plac|plat|картиц|плаћ|плат/iu.test(text);
 const discount=/скидк|discount|popust|попуст/iu.test(text);
 const keys=/ключ|keys?|ključ|kljuc|кључ/iu.test(text);
 const appliances=mentionedAppliances(text);
 const presence=/присутств|находиться|быть дома|остаться дома|stay (?:at )?home|be (?:at )?home|budem kod ku[ćc]e|biti kod ku[ćc]e|будем код куће|бити код куће/iu.test(text);
 if(!payment&&!discount&&!keys&&!appliances.length&&!presence)return;
 const facts=await tool('getBusinessInfo',{});if(facts.error)return;
 if(presence&&(facts.presence as {confirmedRequirement?:string}|undefined)?.confirmedRequirement==='UNKNOWN')return {ru:'Требование присутствовать дома в публичных условиях не уточнено. Организацию доступа нужно согласовать с командой до уборки; приём или хранение ключей я обещать не могу.',en:'The public terms do not specify whether you need to stay home. Access needs agreement with the team before cleaning; I cannot promise key collection or storage.','sr-Latn':'Javni uslovi ne određuju da li treba da budete kod kuće. Pristup treba usaglasiti s timom pre čišćenja; ne mogu da obećam preuzimanje ili čuvanje ključeva.','sr-Cyrl':'Јавни услови не одређују да ли треба да будете код куће. Приступ треба усагласити с тимом пре чишћења; не могу да обећам преузимање или чување кључева.'}[locale];
 if(appliances.length===1){
  const entry=(facts.priceCatalog as {code:string;amount:number;label:string;confirmed:boolean}[]|undefined)?.find(e=>e.code===appliances[0]&&e.confirmed);
  if(!entry)return {ru:'Внутренняя мойка этой техники предусмотрена каталогом, но текущая цена пока не подтверждена. Уточним её до оформления.',en:'Inside cleaning of this appliance is listed, but its current price is not confirmed. We need to verify it before booking.','sr-Latn':'Unutrašnje čišćenje ovog uređaja je u katalogu, ali trenutna cena nije potvrđena. Proverićemo je pre rezervacije.','sr-Cyrl':'Унутрашње чишћење овог уређаја је у каталогу, али тренутна цена није потврђена. Проверићемо је пре резервације.'}[locale];
  return entry.label+' — '+formatRsd(entry.amount,locale)+'. '+String(facts.applianceScope);
 }
 if(payment){
  const faq=Array.isArray(facts.faq)?facts.faq as {q:string;a:string}[]:[];
  const confirmed=faq.find(f=>/оплат|pay|pla[ćct]|плат/iu.test(f.q));if(!confirmed)return;
  const answer=locale==='sr-Cyrl'?'Плаћање је готовином после завршеног чишћења, без аванса.':confirmed.a;
  const card=/карт|card|kartic|картиц/iu.test(text)?({ru:' Оплата картой не подтверждена действующими условиями.',en:' Card payment is not confirmed in the current terms.','sr-Latn':' Plaćanje karticom nije potvrđeno važećim uslovima.','sr-Cyrl':' Плаћање картицом није потврђено важећим условима.'}[locale]):'';
  return answer+card;
 }
 if(discount&&(facts.discounts as {publicPromotionConfirmed?:boolean}|undefined)?.publicPromotionConfirmed===false)return {ru:'Общая скидка для постоянных клиентов в публичных условиях не указана. При расчёте учитывается только уже согласованная скидка в подтверждённой карточке клиента. Индивидуальную скидку нужно согласовать отдельно.',en:'No universal returning-customer discount is published. A quote can apply an already approved discount on a verified client record. A new individual discount needs separate approval.','sr-Latn':'Opšti popust za stalne klijente nije objavljen. Obračun može uključiti već odobren popust iz potvrđene kartice klijenta. Novi individualni popust treba posebno usaglasiti.','sr-Cyrl':'Општи попуст за сталне клијенте није објављен. Обрачун може укључити већ одобрен попуст из потврђене картице клијента. Нови индивидуални попуст треба посебно усагласити.'}[locale];
 if(keys&&(facts.access as {confirmedHandoverProcess?:boolean}|undefined)?.confirmedHandoverProcess===false)return {ru:'Общий порядок передачи и хранения ключей в публичных условиях не закреплён. Способ нужно согласовать с командой до фактической передачи; я не могу обещать приём или хранение ключей. Остальные условия уборки можем обсудить здесь.',en:'A general key handover or storage process is not published. The method needs agreement with the team before any actual handover; I cannot promise key collection or storage. We can discuss the other cleaning details here.','sr-Latn':'Opšti postupak predaje ili čuvanja ključeva nije objavljen. Način treba usaglasiti s timom pre same predaje; ne mogu da obećam preuzimanje ili čuvanje ključeva. Ostale detalje čišćenja možemo razjasniti ovde.','sr-Cyrl':'Општи поступак предаје или чувања кључева није објављен. Начин треба усагласити с тимом пре саме предаје; не могу да обећам преузимање или чување кључева. Остале детаље чишћења можемо разјаснити овде.'}[locale];
}
