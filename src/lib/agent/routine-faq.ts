import type {AgentLocale,ToolName,ToolResult} from './contracts';
import {alternativePriceRequest} from './alternative-price';
import {quoteText} from './conversion-intake';
import type {AgentState} from './contracts';
/** Narrow FAQs with fully known catalog status. No invented operational process. */
export async function routineFaq(text:string,locale:AgentLocale,tool:(name:ToolName,args:unknown)=>Promise<ToolResult>){
 const exclude=alternativePriceRequest(text);
 if(exclude){const result=await tool('calculateAlternativePrice',{exclude,evidence:text});if(result.error)return;const q=result.quote as AgentState['quote'];return ({ru:'Вариант без названной техники; выбранные услуги не изменены.','sr-Latn':'Varijanta bez navedenih uređaja; izabrane usluge nisu promenjene.','sr-Cyrl':'Варијанта без наведених уређаја; изабране услуге нису промењене.',en:'An option without the named appliances; your selected services have not changed.'}[locale])+'\n'+quoteText({quote:q},locale);}
 // Business FAQs use the versioned knowledge layer and natural model replies.
}
