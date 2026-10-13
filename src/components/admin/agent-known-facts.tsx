import type {AgentState} from '@/lib/agent/contracts';
import {siteContent} from '@/lib/content';
import {money} from './crm-view';
export function AgentKnownFacts({facts,quote}:{facts:AgentState['draftFacts'];quote:AgentState['quote']}){
 if(!facts&&!quote)return null;
 const values:[string,string|number|undefined][]=[['Услуга',siteContent.ru.services.find(s=>s.id===facts?.service)?.name],['Площадь',facts?.area?facts.area+' м²':undefined],['Загрязнение',facts?.soilLevel?({LIGHT:'Лёгкое',NORMAL:'Обычное',HEAVY:'Сильное',EXTREME:'Экстремальное'}[facts.soilLevel]):undefined],['Санузлы',facts?.bathroomCount],['Район',facts?.neighborhoodHint],['Дата',facts?.requestedDate],['Адрес для проверки',facts?.addressQuery],['Большие окна',facts?.windowCleaning?.largeCount],['Стандартные окна',facts?.windowCleaning?.standardCount],['Мойка окон',facts?.windowCleaning?.requested===false?'Не нужна':undefined],['Пожелание по команде',facts?.requestedCrew?facts.requestedCrew+' человек':undefined]];
 return <section><h3>Сообщённые детали заявки</h3><dl>{values.filter(([,value])=>value!==undefined).map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{quote&&<p>Расчёт известных позиций: <strong>{money(quote.total,'RSD')}</strong>. Согласование дополнительных деталей и проверка записи выполняются отдельно.</p>}</section>;
}
