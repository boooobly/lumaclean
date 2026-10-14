import {mentionedAppliances} from './appliance-facts';
export function alternativePriceRequest(text:string){
 const comparison=/(?:^|\s)(?:без|without|bez|без)\s/iu.test(text)&&(/\?/u.test(text)||/сколько|how much|koliko|колико/iu.test(text));
 if(!comparison||/уберите|убрать|не надо|remove|exclude|ukloni|уклони|отмен/iu.test(text))return;
 const codes=mentionedAppliances(text);return codes.length?codes:undefined;
}
