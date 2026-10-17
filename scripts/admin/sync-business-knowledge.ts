import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {knowledgeSnapshotSchema,type KnowledgeEntry} from '../../src/lib/agent/knowledge/schema';
import {knowledgeAliases} from '../../src/lib/agent/knowledge/vocabulary';

// Input is a fresh, reviewed, range-limited export of tabs 01–06, never a workbook dump.
// This command writes a reviewable local snapshot; it never contacts production or changes prices.
const input=process.argv[2];if(!input)throw new Error('Usage: tsx scripts/admin/sync-business-knowledge.ts <fresh-bounded-source.json>');
type Source={title:string;rows:{row:number;cells:(string|number|null)[]}[]};
const source=JSON.parse(readFileSync(input,'utf8')) as Source[];
if(source.length!==6||source.some((s,i)=>!s.title.startsWith(String(i+1).padStart(2,'0'))))throw new Error('Only six approved source tabs are accepted');
for(const [tab,column] of [[1,7],[2,5],[3,5],[4,4]])if(!/ПРОЕКТ/iu.test(String(source[tab-1].rows.find(r=>r.row===4)?.cells[column]??'')))throw new Error(`Project-value header required in tab ${tab}`);
const rows=(tab:number)=>source[tab-1].rows.filter(r=>r.row>=5);
const value=(v:unknown)=>String(v??'').replace(/\s+/gu,' ').trim();
const internal=/себестоим|маржин|экономик|чел[. -]*(?:мин|час)|человеко|норматив|норма времени|порог времени|11!|рынок|n\s*=\s*\d|команда\s*K|доход|прибыл|зарплат|выплат|внутренн.{0,15}(?:расч|финанс)|fallback|буфер|optimizer|затрат|активн.{0,12}мин|минут.{0,20}(?:одного клинера|активного труда)|подтвержден.{0,15}владел|хронометр|не активный труд/iu;
function clean(v:unknown){return value(v).split(/(?<=[.;])\s+|(?=Время —)/u).filter(s=>!internal.test(s)).join(' ').slice(0,700);}
const map:Record<string,string>={'ADD-WINDOW-001':'standardWindow','ADD-WINDOW-002':'largeWindow','ADD-OUTDOOR-001':'balcony','ADD-KITCHEN-001':'fridge','ADD-KITCHEN-004':'oven','ADD-KITCHEN-005':'microwave','ADD-KITCHEN-006':'hood','ADD-KITCHEN-008':'dishwasher','ADD-KITCHEN-009':'washingMachine','ADD-KITCHEN-017':'cabinets','ADD-TEXTILE-005':'ironing','ADD-TEXTILE-008':'linen','ADD-PET-001':'petHair','ADD-SPECIAL-020':'steam'};
const entries:KnowledgeEntry[]=[];
function entry(code:string,name:string,category:KnowledgeEntry['category'],tab:number,row:number):KnowledgeEntry{
 return{code,name,category,aliases:knowledgeAliases(code,name),status:'OFFERED',description:name,unit:'по согласованию',price:null,tariffs:[],appliesTo:[],includes:'',excludes:'',restrictions:'',standalone:'BY_AGREEMENT',managerReview:true,autoCalculate:false,autoBook:false,runtimeCode:null,source:{tab,row}};
}
for(const tab of [2,3])for(const r of rows(tab)){
 const c=r.cells,e=entry(value(c[0]),value(c[2]),tab===2?'extra':'upholstery',tab,r.row);
 if(!e.code)continue;
 e.status=c[8]==='Не оказываем'?'UNAVAILABLE':c[8]==='По согласованию'?'BY_AGREEMENT':'OFFERED';
 e.unit=value(c[3]).replace(/чел[. -]*час/gu,'час работы исполнителя');e.includes=tab===2&&c[9]!=='Нет'?clean(c[9]):'';e.restrictions=clean(c[tab===2?10:9]);
 e.runtimeCode=map[e.code]??null;
 e.appliesTo=tab===2?['cleaning']:['upholstery'];
 if(e.code==='ADD-BATH-001'||e.code==='ADD-BATH-003')e.appliesTo=['regular'];
 if(e.code==='ADD-BATH-002'||e.code==='ADD-BATH-004')e.appliesTo=['deep'];
 if(e.code.startsWith('ADD-OFFICE-'))e.appliesTo=['office'];
 if(e.code.startsWith('ADD-RENTAL-'))e.appliesTo=['airbnb'];
 e.standalone=tab===3?'YES':'BY_AGREEMENT';
 e.managerReview=e.status!=='OFFERED'||!e.runtimeCode;
 e.autoCalculate=!!e.runtimeCode&&e.status==='OFFERED';
 e.autoBook=e.autoCalculate&&!['largeWindow','steam'].includes(e.runtimeCode!);
 if(e.status!=='UNAVAILABLE'&&typeof c[5]==='number')e.price={amount:c[5],currency:'RSD',kind:c[5]===0?'included':e.unit==='%'?'percent':tab===3||/от|согласован/iu.test(value(c[4]))?'from':'fixed',unit:e.unit};
 if(e.price?.kind==='included')e.restrictions=clean(e.restrictions+' Входит только в соответствующую согласованную работу, не бесплатный самостоятельный выезд.');
 if(e.code==='UPH-SOFA-004')e.restrictions='Угловой диван до 4 посадочных мест. Каждое место сверх четырёх — 2 000 RSD по UPH-SOFA-006; окончательная цена после проверки ткани и состояния.';
 if(e.code==='UPH-SOFA-006')e.restrictions='За каждое посадочное место сверх четырёх у углового дивана. Не цена целого углового дивана.';
 if(e.code==='UPH-RULE-001'||e.code==='ADD-LOGISTICS-002')e.restrictions='Минимальная итоговая стоимость отдельного выезда на химчистку — 4 000 RSD. Это нижний предел суммы, не дополнительный сбор. При совместной уборке условия согласуются; минимум повторно не начисляется.';
 if(e.code==='ADD-LOGISTICS-001')e.restrictions='Общий минимум отдельного заказа не заменяет стартовые цены пакетов. Поддерживающая уборка начинается от 4 900 RSD; итог пакета только через calculatePrice.';
 if(e.code==='ADD-BATH-002')e.restrictions='Сверх одного включённого стандартного санузла при генеральной уборке. Локальный налёт входит; сплошной сильный налёт и швы оцениваются отдельно, не начислять одну работу дважды.';
 if(e.code==='ADD-LOGISTICS-011')e.restrictions='Дополнительный час команды только за новый заранее согласованный объём, не за превышение времени согласованной уборки.';
 if(e.code==='ADD-LOGISTICS-012')e.restrictions='Дополнительные 30 минут команды за новый заранее согласованный объём; альтернатива дополнительному часу, не одновременно за то же время.';
 if(e.code==='ADD-TEXTILE-001')e.restrictions='Одна стандартная загрузка до 5 кг в машине клиента. В генеральную включена одна загрузка; дополнительная оплачивается отдельно. Глажка и смена белья не включены.';
 if(e.code==='ADD-SPECIAL-020')e.restrictions='Локальная обработка доступной зоны до 5 м² совместно с уборкой. Парогенератор приобретается под подтверждённый запрос; оборудование и возможность работы предварительно согласовать. Не дезинфекция.';
 if(e.code==='ADD-KITCHEN-004')e.restrictions='Стандартная бытовая духовка внутри, без демонтажа и ремонта. Сильный пригар или нестандартный объём согласуется заранее.';
 if(e.status==='UNAVAILABLE'){e.price=null;e.autoBook=false;e.autoCalculate=false;}
 entries.push(e);
}
const packages:Record<string,string>={REG:'regular',DEEP:'deep',MOVE:'move',AIRBNB:'airbnb',OFFICE:'office'};
for(const r of rows(6)){
 const c=r.cells,key=packages[value(c[0])];if(!key)throw new Error('Unknown package');
 const e=entry(`PACKAGE-${value(c[0])}`,value(c[1]),'cleaning',6,r.row);
 e.runtimeCode=key;e.unit='м² / диапазон площади';e.includes=clean(c[4]);e.excludes=clean(c[5]);e.restrictions=clean(c[7]);e.appliesTo=[key];e.managerReview=false;e.autoCalculate=true;e.autoBook=true;e.standalone='YES';
 e.includes=e.includes.replace(/ и 15 мин/gu,'').replace(/Ожидание машины[^.]*\./gu,'Ожидание завершения стирки и дополнительный визит согласуются заранее.');
 // Sheet names vary; the five consecutive groups are fixed by stable service codes.
 const group=rows(1).slice(Object.values(packages).indexOf(key)*5,Object.values(packages).indexOf(key)*5+5);
 if(group.some((x,i)=>x.cells[0]!==`${c[0]}_${i+1}`))throw new Error('Service band code mismatch');
 e.tariffs=group.map(x=>({min:Number(x.cells[5]),max:typeof x.cells[6]==='number'?x.cells[6]:null,amount:Number(x.cells[7]),unit:String(x.cells[4]).includes('м²')?'m²':'object'}));
 e.description='Пакет по диапазонам площади. Верхняя граница диапазона не включена. От 100 м² ставка за м²; итог, срочность и согласованные условия только через calculatePrice.';
 e.price={amount:Number(group[0].cells[7]),currency:'RSD',kind:'from',unit:'за пакет до 39 м²'};
 entries.push(e);
}
for(const r of rows(5)){
 const c=r.cells,e=entry(value(c[0]),value(c[2]),'scope',5,r.row);if(!e.code)continue;
 e.status=c.slice(3,8).some(v=>value(v)==='Входит')?'OFFERED':c.slice(3,8).some(v=>/доплат|согласован/iu.test(value(v)))?'BY_AGREEMENT':'UNAVAILABLE';
 e.unit='в составе пакета';e.description=Object.values(packages).map((p,i)=>`${p}: ${value(c[i+3])}`).join('; ');e.restrictions=clean(c[8]);e.appliesTo=Object.values(packages);e.standalone='NO';
 if(['SCOPE-BATH-010','SCOPE-BATH-012'].includes(e.code))e.restrictions='В генеральную входит только локальная проработка до 2 м² на санузел. Сплошной сильный налёт или швы — отдельный согласованный объём, без двойного начисления.';
 if(e.code==='SCOPE-SPECIAL-004')e.restrictions='Eco steam до 5 м², по предварительному согласованию оборудования и совместимости материала; доставка включена.';
 entries.push(e);
}
// Public interpretations of approved rules. Excludes labour norms, buffers, economics and inactive draft fees.
const rules:Record<string,string>={
 'RULE-GENERAL-001':'Цены указаны в RSD. Итог заказа рассчитывается сервером по подтверждённому составу работ.',
 'RULE-GENERAL-009':'Один стандартный полный санузел включён в базовую уборку. Дополнительный полный санузел: поддерживающая 1 200 RSD, генеральная 2 500 RSD. Итог с таким дополнением согласуется отдельно.',
 'RULE-GENERAL-010':'Одна стандартная кухня входит в пакет; внутренности техники и шкафов оплачиваются отдельно.',
 'RULE-GENERAL-011':'Стандартные спальни входят в пределах оплаченной площади и обычного состояния квартиры.',
 'RULE-GENERAL-013':'Консультация и предварительная оценка по описанию или фото бесплатны; это не подтверждение записи или гарантированной цены.',
 'RULE-HOURS-011':'Принимаем заявки 09:00–22:00 по Белграду. Выезды 09:00–17:00, окончание по подтверждённому слоту. Свободное время проверяется отдельно.',
 'RULE-HOURS-012':'В субботу работаем по доступным слотам; приём заявок 09:00–22:00 по Белграду.',
 'RULE-HOURS-013':'В воскресенье работаем по доступным слотам; приём заявок 09:00–22:00 по Белграду.',
 'RULE-HOURS-009':'Рекомендуем обращаться за 24 часа. Срочный выезд возможен только после проверки реального времени и команды.',
 'RULE-URGENCY-001':'Заказ на сегодня: надбавка +20% одна на весь заказ, только при доступном реальном слоте. После 17:00 по Белграду запись на сегодня закрыта. Цена и возможность выезда подтверждаются сервером.',
 'RULE-URGENCY-002':'За заказ на следующий день отдельной надбавки за срочность нет.',
 'RULE-URGENCY-005':'Автоматической надбавки за субботу или воскресенье нет.',
 'RULE-URGENCY-006':'Праздничная надбавка +20%, только одна надбавка. Итог и условия согласовать с командой: автоматический расчёт праздника не поддерживается.',
 'RULE-CREW-001':'Стандартно работаем вдвоём. Цена за согласованный объём уборки, не за каждого клинера. Фактическая команда и длительность подтверждаются сервером.',
 'RULE-CREW-005':'Дополнительного третьего клинера сейчас не предлагаем.',
 'RULE-CREW-015':'Есть обычный и моющий пылесосы. Химчистка выполняется методом влажной экстракции профессиональным оборудованием Kärcher. Конкретную модель не обещаем. Парогенератор под запрос требует предварительного подтверждения.',
 'RULE-LOYALTY-011':'Регулярные уборки и большие объёмы обсуждаются индивидуально. Автоматических общих скидок нет; уже согласованные условия сохраняются.',
 'RULE-LOYALTY-012':'Индивидуальную цену, состав работ, периодичность и условия пересмотра фиксируем письменно. Новая скидка требует согласования.',
 'RULE-LOYALTY-013':'Индивидуальное предложение действует 7 дней, если не согласовано иначе.',
 'RULE-LOYALTY-014':'Скидки не суммируются автоматически.',
 'RULE-TRAVEL-001':'Работаем по всему Белграду; обычный выезд в согласованном объёме включён. За пределами Белграда возможность и стоимость согласуются индивидуально.',
 'RULE-TRAVEL-006':'Доставка моющего пылесоса включена в согласованную услугу; отдельного сбора за оборудование нет.',
 'RULE-TRAVEL-008':'Обычные средства и расходники включены в согласованную стоимость уборки.',
 'RULE-TRAVEL-009':'Средства клиента можно использовать по предварительному согласованию и с учётом совместимости с поверхностями; автоматической скидки за это нет.',
 'RULE-TRAVEL-010':'Обычно привозим свой пылесос; использование пылесоса клиента по согласованию.',
 'RULE-TRAVEL-013':'Специальные средства и материалы согласуются заранее в итоговой смете, без скрытых доплат.',
 'RULE-PAY-001':'Обязательной предоплаты нет.',
 'RULE-PAY-003':'Наличные: динары или евро. Для евро — текущий курс Google с округлением до целого евро; сумму согласуем до оплаты. Это не автоматическая конвертация серверного расчёта.',
 'RULE-PAY-004':'Принимаем банковский перевод в рублях по согласованному правилу 1:1: заказ 4 900 RSD оплачивается 4 900 RUB. Это правило оплаты компании, не рыночный валютный курс.',
 'RULE-PAY-005':'Доступность оплаты картой пока не подтверждена. Подтверждены наличные и банковский перевод. Сам вопрос не требует передачи разговора оператору.',
 'RULE-PAY-006':'Выдача фискального чека пока не подтверждена. Если он обязателен для заказа, условия согласуем заранее.',
 'RULE-PAY-007':'Платы за позднюю отмену нет. Просим сообщить об отмене или переносе как можно раньше. Изменение существующего заказа оформляет команда.',
 'RULE-PAY-010':'Недостатки согласованной уборки исправляем бесплатно; время повторного визита согласуем. Новые работы не относятся к исправлению недостатков.',
 'RULE-PAY-011':'Просим сообщить о недостатках в течение 12 часов после уборки. Это срок обращения, не обещание приехать в течение 12 часов. Более позднее обращение рассматривается индивидуально.',
 'RULE-PAY-012':'Повреждение имущества, спор, компенсация или возврат рассматриваются владельцем. Администратор фиксирует обращение и передаёт человеку, не обещая денежных компенсаций.',
 'RULE-PAY-013':'Опасные отходы, иглы, биологические загрязнения, канализационные стоки и опасные химические вещества не убираем.',
 'RULE-PAY-014':'Удаление плесени, последствия затопления и опасные загрязнения не оказываем.',
 'RULE-PAY-015':'Послеремонтную уборку сейчас не оказываем. Уборка при переезде предназначена для пустой квартиры в обычном бытовом состоянии, не для строительной пыли и мусора.',
 'RULE-PAY-016':'Полное удаление всех пятен и запахов не гарантируем. Для химчистки проверяем ткань, маркировку и устойчивость цвета; совместимость и окончательную цену согласует менеджер. Точный срок высыхания без проверки условий не обещаем.',
};
for(const [code,description] of Object.entries(rules)){
 const r=rows(4).find(x=>x.cells[0]===code);if(!r)throw new Error(`Missing rule ${code}`);
 const e=entry(code,value(r.cells[2]),'rule',4,r.row);e.description=description;e.restrictions=description;e.unit='правило обслуживания';e.standalone='NO';
 if(['RULE-PAY-005','RULE-PAY-006','RULE-URGENCY-006'].includes(code))e.status='BY_AGREEMENT';
 if(['RULE-CREW-005','RULE-PAY-013','RULE-PAY-014','RULE-PAY-015'].includes(code))e.status='UNAVAILABLE';
 entries.push(e);
}
for(const e of entries){if(internal.test(JSON.stringify(e)))throw new Error(`Private source fragment in ${e.code}`);}
if(new Set(entries.map(e=>e.code)).size!==entries.length)throw new Error('Duplicate stable code');
if(rows(2).length!==280||rows(3).length!==94||rows(5).length!==108)throw new Error('Source row count changed; review the importer bounds');
const snapshot=knowledgeSnapshotSchema.parse({schemaVersion:1,version:'2026-10-17.'+createHash('sha256').update(JSON.stringify(entries)).digest('hex').slice(0,12),sourceId:'1Xua3GrAYAgYfcbYUEWrU6I6cMZEA0IULLdSuKrbW4DY',sourceHash:createHash('sha256').update(JSON.stringify(source)).digest('hex'),entries});
writeFileSync('src/lib/agent/knowledge/snapshot.json',JSON.stringify(snapshot,null,2)+'\n');
console.log(JSON.stringify({version:snapshot.version,count:entries.length,statuses:Object.fromEntries(['OFFERED','BY_AGREEMENT','UNAVAILABLE'].map(s=>[s,entries.filter(e=>e.status===s).length]))}));

