import {siteContent} from '@/lib/content';
import {applianceLabels} from '@/lib/appliance-catalog';
export function businessLabels(locale:string):Record<string,string>{
 const base=siteContent[locale.startsWith('sr')?'sr':locale==='en'?'en':'ru'].calculator.labels;
 return {...base,...(locale==='sr-Cyrl'?{standardWindow:'Стандардни прозор',largeWindow:'Велики прозор',balcony:'Балкон',cabinets:'Унутрашњост ормара',ironing:'Пеглање',steam:'Парни третман',linen:'Постељина',petHair:'Длаке кућних љубимаца'}:{}),...applianceLabels[locale==='sr-Cyrl'?'sr-Cyrl':locale.startsWith('sr')?'sr':locale==='en'?'en':'ru']};
}
export function businessServiceLabel(service:string,locale:string){
 if(locale==='sr-Cyrl')return ({regular:'Одржавајуће чишћење',deep:'Генерално чишћење',move:'Чишћење при селидби',airbnb:'Airbnb чишћење',office:'Чишћење канцеларије'} as Record<string,string>)[service];
 return siteContent[locale.startsWith('sr')?'sr':locale==='en'?'en':'ru'].services.find(s=>s.id===service)?.name;
}
