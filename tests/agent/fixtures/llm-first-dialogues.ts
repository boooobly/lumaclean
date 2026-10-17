import type {AgentLocale,AgentState,ToolName} from '../../../src/lib/agent/contracts';

export type Dialogue={id:string;split:'development'|'holdout';locale:AgentLocale;initial:AgentState;turns:string[][];facts:NonNullable<AgentState['draftFacts']>;must:ToolName[];forbid:ToolName[];result:'QUOTE'|'FAQ'|'REVIEW'|'HANDOFF';takeover?:boolean;criteria:string[]};
const locales:AgentLocale[]=['ru','sr-Latn','sr-Cyrl','en'];
type Family={id:string;split:Dialogue['split'];messages:string[][][];facts?:Dialogue['facts'];must:ToolName[];result:Dialogue['result'];takeover?:boolean};
// Frozen before development runs. Each cell is a complete customer dialogue;
// nested strings in a turn exercise the real unanswered-message burst, not separate answers.
const families:Family[]=[
 {id:'appliances',split:'development',result:'QUOTE',must:['calculatePrice'],facts:{service:'regular',area:88,soilLevel:'NORMAL',extrasConfirmed:true,extras:[{code:'fridge',quantity:1},{code:'oven',quantity:1}]},messages:[
 [['Хочу обычную уборку 88 квадратов и холодильник с духовкой изнутри. Сколько стоит?'],['Обычное загрязнение'],['На какую дату можно записаться?']],
 [['Treba mi redovno čišćenje 88 m2, frižider i rerna iznutra. Koliko sve košta?'],['Normalno zaprljano'],['Kako da izaberem datum?']],
 [['Желим редовно чишћење 88 м2, фрижидер и рерна изнутра. Колико кошта?'],['Нормално запрљано'],['Како да изаберем датум?']],
 [['Regular cleaning, 88m2, fridge and oven inside. How much altogether?'],['Normal dirt'],['How do I choose a date?']]]},
 {id:'corrections',split:'development',result:'QUOTE',must:['calculatePrice'],facts:{service:'regular',area:75,soilLevel:'NORMAL',extrasConfirmed:true,extras:[]},messages:[
 [['Генеральная уборка 60 м², обычная грязь, без допов'],['Я сказал 60, но там 75 квадратов'],['Хотя нет, давайте поддерживающую'],['Сколько теперь будет стоить?']],
 [['Generalno čišćenje 60 m2, normalna prljavština, bez dodataka'],['Pogrešio sam, ipak je 75 m2'],['Ipak redovno čišćenje, ne generalno'],['Koliko košta sada?']],
 [['Генерално чишћење 60 м2, нормална прљавштина, без додатака'],['Погрешио сам, ипак 75 м2'],['Ипак редовно чишћење'],['Колико кошта сада?']],
 [['Deep cleaning 60m2, normal dirt, no extras'],['I said 60 but it is actually 75m2'],['Actually regular cleaning please'],['What is the price now?']]]},
 {id:'faq',split:'development',result:'FAQ',must:['getBusinessInfo'],messages:[
 [['Здравствуйте!'],['Можно со своим пылесосом?'],['А средства вы приносите?'],['Как можно оплатить?']],
 [['Ćao!'],['Mogu li da koristim svoj usisivač?'],['Donosite svoja sredstva?'],['Kako mogu da platim?']],
 [['Здраво!'],['Могу ли да користим свој усисивач?'],['Доносите своја средства?'],['Како могу да платим?']],
 [['Hello!'],['Can you use my vacuum cleaner?'],['Do you bring cleaning products?'],['How can I pay?']]]},
 {id:'safety',split:'development',result:'HANDOFF',must:['requestHumanHandoff'],messages:[
 [['Какие уборки есть?'],['А после ремонта?'],['У меня строительный мусор и иглы на полу, уберите пожалуйста']],
 [['Koje usluge imate?'],['A posle renoviranja?'],['Kod mene ima građevinskog otpada i igala, molim vas uklonite']],
 [['Које услуге имате?'],['А после реновирања?'],['Код мене има грађевинског отпада и игала, молим вас уклоните']],
 [['What services do you offer?'],['And after renovation?'],['I have construction debris and needles on the floor, please remove them']]]},
 {id:'windows',split:'holdout',result:'REVIEW',must:['requestReview'],facts:{service:'deep',area:80,soilLevel:'NORMAL',reviewItems:['roletne']},messages:[
 [['Генеральная уборка 80 м², обычное загрязнение'],['Ещё окна и рольставни'],['2 стандартных окна, других допов нет'],['Рольставни тоже надо. Сколько вместе?']],
 [['Generalno čišćenje 80 m2, normalno zaprljano'],['Treba i prozore i roletne'],['Dva standardna prozora, bez drugih dodataka'],['I roletne ostaju. Koliko sve košta?']],
 [['Генерално чишћење 80 м2, нормално запрљано'],['Треба и прозоре и ролетне'],['Два стандардна прозора, без других додатака'],['И ролетне остају. Колико све кошта?']],
 [['Deep clean 80m2, normal dirt'],['Windows and shutters too'],['Two standard windows, no other extras'],['Keep shutters too. How much altogether?']]]},
 {id:'contact',split:'holdout',result:'REVIEW',must:['requestReview','createOrUpdateLead'],facts:{service:'regular',area:60,preferredContactChannel:'SMS'},messages:[
 [['Поддерживающая уборка 60 м², обычная грязь, без допов'],['Можно ответить SMS?'],['Дать номер?'],['Спасибо, цену напишите здесь']],
 [['Redovno čišćenje 60 m2, normalno zaprljano, bez dodataka'],['Može odgovor SMS-om?'],['Da pošaljem broj?'],['Hvala, cenu napišite ovde']],
 [['Редовно чишћење 60 м2, нормално запрљано, без додатака'],['Може одговор СМС-ом?'],['Да пошаљем број?'],['Хвала, цену напишите овде']],
 [['Regular clean 60m2, normal dirt, no extras'],['Could you reply by SMS?'],['Should I send my number?'],['Thanks, please put the price here']]]},
 {id:'mixed',split:'holdout',result:'QUOTE',must:['calculatePrice'],facts:{service:'regular',area:60,soilLevel:'NORMAL',extrasConfirmed:true,extras:[{code:'fridge',quantity:1}]},messages:[
 [['Обычная уборка 60 м², нормальная грязь. Сколько стоит? А завтра сможете? И ещё духовку изнутри'],['Холодильник изнутри тоже. Окон не надо, больше ничего'],['Давайте без духовки, холодильник оставляем'],['Я уже это говорил. Сколько стоит?']],
 [['Redovno čišćenje 60 m2, normalno. Koliko košta? Može sutra? I rerna iznutra'],['I frižider iznutra. Bez prozora, ništa drugo'],['Bez rerne, frižider ostaje'],['Već sam rekao. Koliko košta?']],
 [['Редовно чишћење 60 м2, нормално. Колико кошта? Може сутра? И рерна изнутра'],['И фрижидер изнутра. Без прозора, ништа друго'],['Без рерне, фрижидер остаје'],['Већ сам рекао. Колико кошта?']],
 [['Regular 60m2, normal dirt. Price? Could you come tomorrow? Oven inside too'],['Fridge inside as well. No windows, nothing else'],['Remove oven, keep fridge'],['I already said that. What is the price?']]]},
 {id:'uncertainty',split:'holdout',result:'QUOTE',must:['getBusinessInfo','calculatePrice'],facts:{service:'deep',area:80,soilLevel:'NORMAL',extrasConfirmed:true,bathroomCount:3},messages:[
 [['Не знаю точно, кажется нужна генеральная уборка'],['Да, генеральную. 80 квадратов, у меня три санузла'],['Обычное загрязнение, без дополнительных услуг'],['Сколько стоит и что входит?']],
 [['Ne znam tačno, mislim da mi treba generalno čišćenje'],['Da, generalno. 80 m2, tri kupatila'],['Normalno zaprljano, bez dodataka'],['Koliko košta i šta je uključeno?']],
 [['Не знам тачно, мислим да треба генерално чишћење'],['Да, генерално. 80 м2, три купатила'],['Нормално запрљано, без додатака'],['Колико кошта и шта је укључено?']],
 [['Not sure, I think I need deep cleaning'],['Yes deep. 80m2, three bathrooms'],['Normal dirt, no extras'],['How much and what is included?']]]},
 {id:'photos',split:'holdout',result:'QUOTE',must:['getBusinessInfo','calculatePrice'],facts:{service:'regular',area:60,soilLevel:'NORMAL',extrasConfirmed:true},messages:[
 [['Можно фотографию отправить?'],['Нужна обычная уборка, 60 м²'],['Обычное загрязнение, допов нет'],['Сколько стоит?']],
 [['Mogu da pošaljem fotografiju?'],['Treba redovno čišćenje 60 m2'],['Normalno zaprljano, bez dodataka'],['Koliko košta?']],
 [['Могу да пошаљем фотографију?'],['Треба редовно чишћење 60 м2'],['Нормално запрљано, без додатака'],['Колико кошта?']],
 [['Can I send a photo?'],['I need regular cleaning, 60m2'],['Normal dirt, no extras'],['What is the price?']]]},
 {id:'upholstery',split:'holdout',result:'REVIEW',must:['getBusinessInfo','requestReview'],messages:[
 [['Сколько стоит химчистка трёхместного дивана?'],['Это влажная химчистка или пар?'],['Хочу заказать, ткань не знаю'],['Когда менеджер уточнит?']],
 [['Koliko košta pranje troseda?'],['Da li je to parno čišćenje?'],['Hoću da zakažem, ne znam materijal'],['Kako će tim proveriti detalje?']],
 [['Колико кошта прање троседа?'],['Да ли је то парно чишћење?'],['Желим да закажем, не знам материјал'],['Како ће тим проверити детаље?']],
 [['How much to clean a three seat sofa?'],['Is that steam cleaning?'],['I want to book, not sure of fabric'],['How will the team check details?']]]},
 {id:'rapid',split:'holdout',result:'QUOTE',must:['calculatePrice'],facts:{service:'regular',area:75,soilLevel:'NORMAL',extrasConfirmed:true},messages:[
 [['Нужна уборка','Обычная, 60 м²','Нет, 75 м²'],['Обычное загрязнение, без допов'],['20 октября, любое время'],['Какая цена?']],
 [['Treba čišćenje','Redovno, 60 m2','Ne, 75 m2'],['Normalno zaprljano, bez dodataka'],['20. oktobra, bilo kada'],['Koja je cena?']],
 [['Треба чишћење','Редовно, 60 м2','Не, 75 м2'],['Нормално запрљано, без додатака'],['20. октобра, било када'],['Која је цена?']],
 [['Need cleaning','Regular, 60m2','Sorry, 75m2'],['Normal dirt, no extras'],['October 20, any time'],['What is the price?']]]},
 {id:'takeover',split:'holdout',result:'QUOTE',must:['reconcileHumanContext','calculatePrice'],takeover:true,facts:{service:'regular',area:75,soilLevel:'NORMAL',extrasConfirmed:true},messages:[
 [['Обычная уборка 60 м², обычная грязь, допов нет'],['Спасибо. Всё-таки 75 м²'],['Какая актуальная стоимость?']],
 [['Redovno čišćenje 60 m2, normalno zaprljano, bez dodataka'],['Hvala. Ipak 75 m2'],['Koja je sada cena?']],
 [['Редовно чишћење 60 м2, нормално запрљано, без додатака'],['Хвала. Ипак 75 м2'],['Која је сада цена?']],
 [['Regular 60m2, normal dirt, no extras'],['Thanks. It is actually 75m2'],['What is the current price?']]]},
];
export const llmFirstDialogues:Dialogue[]=families.flatMap(f=>locales.map((locale,i)=>({id:f.id+'-'+locale,split:f.split,locale,initial:{},turns:f.messages[i],facts:f.facts??{},must:f.must,forbid:['createOrder','rescheduleOrder','getClientAddresses'],result:f.result,takeover:f.takeover,criteria:['Exact final expected facts; corrections preserved','Successful required tools; no forbidden tool success','Quote uses current server catalogue and matches confirmed facts','No ungrounded price, slot or booking; no duplicate reply','Provider outages remain INCONCLUSIVE; recovery is not success','Naturalness requires separate blind review']})));
