import type {AgentLocale,ToolName,ToolResult} from './contracts';
import {mandatoryHandoff,substantiveIntent} from './policy';
/** Narrow FAQs with fully known catalog status. No invented operational process. */
export async function routineFaq(text:string,locale:AgentLocale,tool:(name:ToolName,args:unknown)=>Promise<ToolResult>){
 if(mandatoryHandoff(text)||substantiveIntent(text)||(text.match(/\?/g)?.length??0)>1||!/\?|^(?:как|есть|какие|можно|how|what|do you|can i|kako|koliko|da li|mogu li|како|да ли|могу ли)/iu.test(text.trim()))return;
 const payment=/оплат|картой|payment|pay by card|kartic|plać|plac|plat|картиц|плаћ|плат/iu.test(text);
 const discount=/скидк|discount|popust|попуст/iu.test(text);
 const keys=/ключ|keys?|ključ|kljuc|кључ/iu.test(text);
 if(!payment&&!discount&&!keys)return;
 const facts=await tool('getBusinessInfo',{});if(facts.error)return;
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
