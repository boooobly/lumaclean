import type {Locale} from "@/i18n/routing";
import type {ServiceId} from "./pricing";

type Service = {id: ServiceId; name: string; description: string; tag: string};

export type SiteContent = {
  nav: {services: string; prices: string; process: string; faq: string; cta: string};
  hero: {eyebrow: string; title: string; accent: string; body: string; primary: string; secondary: string; hint: string; clean: string; reveal: string};
  proof: string[];
  intro: {eyebrow: string; title: string; body: string};
  services: Service[];
  layers: {eyebrow: string; title: string; body: string; rooms: {index: string; room: string; title: string; text: string; callouts: string[]}[]};
  comparison: {eyebrow: string; title: string; regular: {title: string; text: string; items: string[]}; deep: {title: string; text: string; items: string[]}};
  pricing: {eyebrow: string; title: string; body: string; area: string[]; from: string; note: string; serviceNames: Record<ServiceId, string>};
  calculator: {eyebrow: string; title: string; body: string; service: string; area: string; extras: string; result: string; from: string; note: string; book: string; urgent: string; labels: Record<string, string>};
  process: {eyebrow: string; title: string; steps: {number: string; title: string; text: string}[]};
  assurance: {eyebrow: string; title: string; items: {title: string; text: string}[]; unavailable: string; unavailableItems: string[]};
  faq: {eyebrow: string; title: string; items: {q: string; a: string}[]};
  contact: {eyebrow: string; title: string; body: string; messenger: string};
  footer: {tagline: string; location: string; rights: string; privacy: string; terms: string};
};

const ru: SiteContent = {
  nav: {services: "Услуги", prices: "Цены", process: "Как работаем", faq: "FAQ", cta: "Рассчитать"},
  hero: {eyebrow: "Клининг по всему Белграду", title: "Чистый дом.", accent: "Легче дышать.", body: "Аккуратная уборка квартир, Airbnb и небольших офисов — с понятной ценой и быстрым ответом в удобном мессенджере.", primary: "Рассчитать стоимость", secondary: "Посмотреть услуги", hint: "Двигайте курсором по комнате", clean: "Чистый слой", reveal: "Что было до LumaClean"},
  proof: ["Выезд в день обращения", "Все районы Белграда", "Можно без химии", "Работаем по выходным"],
  intro: {eyebrow: "Услуги", title: "Нужный уровень чистоты — без лишних пакетов", body: "Выберите сценарий, а детали и дополнительные услуги мы уточним перед выездом. Финальная цена всегда подтверждается заранее."},
  services: [
    {id: "regular", name: "Поддерживающая уборка", description: "Пыль, полы, кухня снаружи, санузел, зеркала и базовый порядок.", tag: "Для регулярного ухода"},
    {id: "deep", name: "Генеральная уборка", description: "Глубокая работа с кухней, санузлом, дверями, плинтусами и трудными зонами.", tag: "Максимум внимания"},
    {id: "move", name: "Въезд и выезд", description: "Подготовка пустой квартиры к заселению или передаче следующему жильцу.", tag: "Переезд без стресса"},
    {id: "airbnb", name: "Airbnb и аренда", description: "Быстрая подготовка апартамента между гостями и смена постельного белья.", tag: "Точно к заезду"},
    {id: "office", name: "Небольшие офисы", description: "Рабочие поверхности, полы, санузел, coffee point и вынос мусора.", tag: "Регулярный график"}
  ],
  layers: {eyebrow: "Luma Layers", title: "Мы замечаем то, что обычно остаётся за кадром", body: "Каждая зона требует своего подхода. Пройдите по квартире — от первого впечатления до точной работы с деталями.", rooms: [
    {index: "01", room: "Гостиная", title: "Пространство снова дышит", text: "Убираем пыль, следы повседневной жизни и возвращаем комнате визуальный покой.", callouts: ["Полы без разводов", "Пыль на открытых поверхностях"]},
    {index: "02", room: "Ванная", title: "Чистота видна в деталях", text: "Зеркала, стекло, сантехника и швы обрабатываются последовательно и аккуратно.", callouts: ["Зеркала без следов", "Удаление известкового налёта", "Детальная обработка швов"]},
    {index: "03", room: "Кухня", title: "Снаружи — в базе. Внутри — по запросу", text: "Можно добавить духовку, холодильник, шкафы и паровую обработку подходящих поверхностей.", callouts: ["Духовка внутри", "Холодильник внутри", "Eco steam"]},
    {index: "04", room: "Спальня", title: "Готово к отдыху или новому гостю", text: "Аккуратный финальный вид, смена белья и подготовка апартамента к заезду.", callouts: ["Смена постельного белья", "Airbnb turnaround"]}
  ]},
  comparison: {eyebrow: "Что выбрать", title: "Поддерживающая или генеральная?", regular: {title: "Поддерживающая", text: "Для квартиры без сильных загрязнений и регулярного ухода.", items: ["Пыль и открытые поверхности", "Полы и пылесос", "Кухня снаружи", "Санузел и зеркала"]}, deep: {title: "Генеральная", text: "Когда нужен глубокий перезапуск пространства.", items: ["Всё из поддерживающей", "Двери, плинтусы, выключатели", "Фасады мебели и труднодоступные зоны", "Больше времени на кухню и санузел"]}},
  pricing: {eyebrow: "Прозрачные цены", title: "Понятно ещё до заявки", body: "Стоимость зависит от площади и состояния. В таблице — ориентиры для квартиры без экстремальных загрязнений.", area: ["до 40 м²", "41–60 м²", "61–80 м²", "81–100 м²", "100+ м²"], from: "от", note: "Минимальный заказ — 4 000 RSD. Окна, техника внутри и сильные загрязнения считаются отдельно.", serviceNames: {regular: "Поддерживающая", deep: "Генеральная", move: "Въезд / выезд", airbnb: "Airbnb / аренда", office: "Офис"}},
  calculator: {eyebrow: "Калькулятор", title: "Соберите свою уборку", body: "Расчёт ориентировочный — финальную стоимость подтвердим после короткого описания или фото.", service: "Тип уборки", area: "Площадь", extras: "Дополнительные услуги", result: "Ориентировочная стоимость", from: "от", note: "Наличные · без предоплаты", book: "Отправить расчёт", urgent: "Срочный выезд сегодня (+20%)", labels: {standardWindow: "Стандартное окно", largeWindow: "Большое окно", balcony: "Балкон / терраса", fridge: "Холодильник внутри", oven: "Духовка внутри", cabinets: "Шкафы внутри", ironing: "Глажка · 30 минут", steam: "Eco steam", petHair: "Много шерсти животных", linen: "Смена постельного белья"}},
  process: {eyebrow: "Как это работает", title: "От сообщения до чистого дома", steps: [{number: "01", title: "Расскажите о квартире", text: "Площадь, район, тип уборки и, если удобно, несколько фото."}, {number: "02", title: "Получите подтверждённую цену", text: "Уточним детали и подтвердим стоимость до выезда."}, {number: "03", title: "Выберите время", text: "Возможны выходные и выезд в день обращения."}, {number: "04", title: "Мы наведём порядок", text: "После уборки вы проверяете результат и оплачиваете наличными."}]},
  assurance: {eyebrow: "Спокойствие", title: "Честные условия без мелкого шрифта", items: [{title: "Цена до начала", text: "Согласуем объём и стоимость заранее."}, {title: "Свои или ваши средства", text: "Подстроимся под пожелания и поверхности."}, {title: "Eco steam", text: "Парогенератор без химии для подходящих зон."}, {title: "Все районы", text: "Работаем по всему Белграду без деления на удобные и неудобные адреса."}], unavailable: "Мы не берёмся за", unavailableItems: ["уборку после ремонта", "плесень и последствия затоплений", "опасные загрязнения", "фасады зданий и промышленный клининг"]},
  faq: {eyebrow: "FAQ", title: "Коротко о важном", items: [{q: "Можно заказать уборку сегодня?", a: "Да, если есть свободное окно. Срочный выезд в день обращения добавляет 20% к стоимости."}, {q: "Нужно ли покупать средства?", a: "Нет. Мы можем приехать со своими средствами или использовать ваши — как вам удобнее."}, {q: "Цена в калькуляторе окончательная?", a: "Это предварительный ориентир. Финальную цену подтверждаем после описания состояния квартиры или фотографий."}, {q: "Вы моете окна?", a: "Да. Стандартное окно — 950 RSD, большое или панорамное — от 1 300 RSD."}, {q: "Как оплатить?", a: "Оплата наличными после выполнения уборки. Предоплата не требуется."}]},
  contact: {eyebrow: "Готовы начать?", title: "Скажите, какая площадь. Остальное рассчитаем мы.", body: "Ответим быстро, уточним детали и предложим ближайшее удобное время.", messenger: "Или напишите напрямую"},
  footer: {tagline: "Аккуратная уборка по всему Белграду.", location: "Белград · все районы", rights: "Все права защищены", privacy: "Конфиденциальность", terms: "Условия"}
};

const sr: SiteContent = {
  ...ru,
  nav: {services: "Usluge", prices: "Cene", process: "Kako radimo", faq: "FAQ", cta: "Izračunaj"},
  hero: {eyebrow: "Čišćenje širom Beograda", title: "Čist dom.", accent: "Lakše se diše.", body: "Pažljivo čišćenje stanova, Airbnb apartmana i malih kancelarija — uz jasnu cenu i brz odgovor u omiljenom mesindžeru.", primary: "Izračunaj cenu", secondary: "Pogledaj usluge", hint: "Pomerajte kursor preko sobe", clean: "Čist sloj", reveal: "Pre LumaClean-a"},
  proof: ["Dolazak istog dana", "Svi delovi Beograda", "Moguće bez hemije", "Rad vikendom"],
  intro: {eyebrow: "Usluge", title: "Pravi nivo čistoće — bez suvišnih paketa", body: "Izaberite scenario, a detalje i dodatne usluge potvrđujemo pre dolaska. Konačna cena se uvek dogovara unapred."},
  services: [
    {id: "regular", name: "Održavajuće čišćenje", description: "Prašina, podovi, kuhinja spolja, kupatilo, ogledala i osnovno sređivanje.", tag: "Za redovno održavanje"},
    {id: "deep", name: "Generalno čišćenje", description: "Detaljan rad na kuhinji, kupatilu, vratima, lajsnama i teško dostupnim zonama.", tag: "Maksimalna pažnja"},
    {id: "move", name: "Useljenje i iseljenje", description: "Priprema praznog stana za useljenje ili predaju sledećem stanaru.", tag: "Selidba bez stresa"},
    {id: "airbnb", name: "Airbnb i najam", description: "Brza priprema apartmana između gostiju i promena posteljine.", tag: "Spremno za dolazak"},
    {id: "office", name: "Male kancelarije", description: "Radne površine, podovi, kupatilo, coffee point i smeće po dogovoru.", tag: "Redovan raspored"}
  ],
  layers: {eyebrow: "Luma Layers", title: "Primećujemo ono što obično ostaje van kadra", body: "Svaka zona traži drugačiji pristup. Prođite kroz stan — od prvog utiska do preciznog rada na detaljima.", rooms: [
    {index: "01", room: "Dnevna soba", title: "Prostor ponovo diše", text: "Uklanjamo prašinu i tragove svakodnevice i vraćamo sobi vizuelni mir.", callouts: ["Podovi bez tragova", "Prašina na otvorenim površinama"]},
    {index: "02", room: "Kupatilo", title: "Čistoća se vidi u detaljima", text: "Ogledala, staklo, sanitarije i fuge obrađujemo redom i pažljivo.", callouts: ["Ogledala bez tragova", "Uklanjanje kamenca", "Detaljna obrada fuga"]},
    {index: "03", room: "Kuhinja", title: "Spolja u osnovi. Iznutra po zahtevu", text: "Možete dodati rernu, frižider, ormariće i parnu obradu odgovarajućih površina.", callouts: ["Rerna iznutra", "Frižider iznutra", "Eco steam"]},
    {index: "04", room: "Spavaća soba", title: "Spremno za odmor ili novog gosta", text: "Uredan završni izgled, promena posteljine i priprema apartmana za dolazak.", callouts: ["Promena posteljine", "Airbnb turnaround"]}
  ]},
  comparison: {eyebrow: "Šta izabrati", title: "Održavajuće ili generalno?", regular: {title: "Održavajuće", text: "Za stan bez jakih zaprljanja i redovno održavanje.", items: ["Prašina i otvorene površine", "Podovi i usisavanje", "Kuhinja spolja", "Kupatilo i ogledala"]}, deep: {title: "Generalno", text: "Kada je prostoru potreban detaljan novi početak.", items: ["Sve iz održavajućeg", "Vrata, lajsne i prekidači", "Frontovi i teške zone", "Više vremena za kuhinju i kupatilo"]}},
  pricing: {...ru.pricing, eyebrow: "Jasne cene", title: "Znate okvir pre nego što pošaljete upit", body: "Cena zavisi od kvadrature i stanja. Tabela prikazuje okvir za stan bez ekstremnih zaprljanja.", area: ["do 40 m²", "41–60 m²", "61–80 m²", "81–100 m²", "100+ m²"], from: "od", note: "Minimalna porudžbina je 4 000 RSD. Prozori, unutrašnjost uređaja i jaka zaprljanja računaju se posebno.", serviceNames: {regular: "Održavajuće", deep: "Generalno", move: "Useljenje / iseljenje", airbnb: "Airbnb / najam", office: "Kancelarija"}},
  calculator: {...ru.calculator, eyebrow: "Kalkulator", title: "Sastavite svoje čišćenje", body: "Obračun je okviran — konačnu cenu potvrđujemo nakon kratkog opisa ili fotografija.", service: "Vrsta čišćenja", area: "Površina", extras: "Dodatne usluge", result: "Okvirna cena", from: "od", note: "Gotovina · bez avansa", book: "Pošalji obračun", urgent: "Hitni dolazak danas (+20%)", labels: {standardWindow: "Standardni prozor", largeWindow: "Veliki prozor", balcony: "Balkon / terasa", fridge: "Frižider iznutra", oven: "Rerna iznutra", cabinets: "Ormarići iznutra", ironing: "Peglanje · 30 minuta", steam: "Eco steam", petHair: "Mnogo dlaka ljubimaca", linen: "Promena posteljine"}},
  process: {eyebrow: "Kako funkcioniše", title: "Od poruke do čistog doma", steps: [{number: "01", title: "Opišite stan", text: "Kvadratura, deo grada, vrsta čišćenja i, ako želite, nekoliko fotografija."}, {number: "02", title: "Dobijte potvrđenu cenu", text: "Proveravamo detalje i potvrđujemo cenu pre dolaska."}, {number: "03", title: "Izaberite vreme", text: "Moguć je rad vikendom i dolazak istog dana."}, {number: "04", title: "Mi sređujemo prostor", text: "Nakon čišćenja proveravate rezultat i plaćate gotovinom."}]},
  assurance: {eyebrow: "Bez brige", title: "Pošteni uslovi bez sitnih slova", items: [{title: "Cena pre početka", text: "Obim i cenu dogovaramo unapred."}, {title: "Naša ili vaša sredstva", text: "Prilagođavamo se vašim željama i površinama."}, {title: "Eco steam", text: "Paročistač bez hemije za odgovarajuće zone."}, {title: "Svi delovi grada", text: "Radimo širom Beograda bez podele na lake i teške adrese."}], unavailable: "Ne radimo", unavailableItems: ["čišćenje nakon renoviranja", "buđ i posledice poplava", "opasna zaprljanja", "fasade zgrada i industrijsko čišćenje"]},
  faq: {eyebrow: "FAQ", title: "Kratko i važno", items: [{q: "Da li mogu da naručim čišćenje danas?", a: "Da, ako imamo slobodan termin. Hitni dolazak istog dana uvećava cenu za 20%."}, {q: "Da li treba da kupim sredstva?", a: "Ne. Možemo doneti svoja sredstva ili koristiti vaša — kako vam više odgovara."}, {q: "Da li je cena iz kalkulatora konačna?", a: "To je dobar okvir. Konačnu cenu potvrđujemo nakon opisa stanja ili fotografija."}, {q: "Da li perete prozore?", a: "Da. Standardni prozor je 950 RSD, veliki ili panoramski od 1 300 RSD."}, {q: "Kako se plaća?", a: "Gotovinom nakon završenog čišćenja. Avans nije potreban."}]},
  contact: {eyebrow: "Spremni?", title: "Recite nam koliki je prostor. Mi ćemo izračunati ostalo.", body: "Odgovaramo brzo, proveravamo detalje i predlažemo najbliži slobodan termin.", messenger: "Ili pišite direktno"},
  footer: {tagline: "Pažljivo čišćenje širom Beograda.", location: "Beograd · svi delovi grada", rights: "Sva prava zadržana", privacy: "Privatnost", terms: "Uslovi"}
};

const en: SiteContent = {
  ...ru,
  nav: {services: "Services", prices: "Prices", process: "How it works", faq: "FAQ", cta: "Estimate"},
  hero: {eyebrow: "Cleaning across Belgrade", title: "Clean home.", accent: "Room to breathe.", body: "Careful cleaning for homes, Airbnb rentals and small offices — with transparent pricing and a fast reply in your preferred messenger.", primary: "Estimate the cost", secondary: "Explore services", hint: "Move your cursor across the room", clean: "Clean layer", reveal: "Before LumaClean"},
  proof: ["Same-day visits", "All Belgrade districts", "Chemical-free option", "Weekends available"],
  intro: {eyebrow: "Services", title: "The right level of clean — no confusing packages", body: "Choose a scenario and we’ll confirm the details and extras before the visit. The final price is always agreed upfront."},
  services: [
    {id: "regular", name: "Regular cleaning", description: "Dusting, floors, kitchen exteriors, bathroom, mirrors and basic tidying.", tag: "For regular care"},
    {id: "deep", name: "Deep cleaning", description: "Focused work on the kitchen, bathroom, doors, skirting boards and difficult areas.", tag: "Maximum attention"},
    {id: "move", name: "Move-in & move-out", description: "Preparing an empty apartment for move-in or handover to the next tenant.", tag: "A calmer move"},
    {id: "airbnb", name: "Airbnb & rentals", description: "Fast turnaround between guests, including optional linen change.", tag: "Ready for check-in"},
    {id: "office", name: "Small offices", description: "Work surfaces, floors, bathroom, coffee point and waste removal by agreement.", tag: "Regular schedule"}
  ],
  layers: {eyebrow: "Luma Layers", title: "We notice what usually stays out of frame", body: "Every zone needs a different approach. Move through the home — from the first impression to precise attention to detail.", rooms: [
    {index: "01", room: "Living room", title: "The space can breathe again", text: "We remove dust and the traces of daily life, restoring visual calm.", callouts: ["Streak-free floors", "Dust-free open surfaces"]},
    {index: "02", room: "Bathroom", title: "Cleanliness lives in the details", text: "Mirrors, glass, fixtures and grout are handled carefully and in sequence.", callouts: ["Streak-free mirrors", "Limescale removal", "Detailed grout care"]},
    {index: "03", room: "Kitchen", title: "Outside is standard. Inside is optional", text: "Add the oven, fridge, cabinets or steam cleaning for suitable surfaces.", callouts: ["Inside oven", "Inside fridge", "Eco steam"]},
    {index: "04", room: "Bedroom", title: "Ready for rest or the next guest", text: "A calm final look, optional linen change and preparation for check-in.", callouts: ["Linen change", "Airbnb turnaround"]}
  ]},
  comparison: {eyebrow: "Which one", title: "Regular or deep cleaning?", regular: {title: "Regular", text: "For homes without heavy soiling and ongoing care.", items: ["Dust and open surfaces", "Floors and vacuuming", "Kitchen exteriors", "Bathroom and mirrors"]}, deep: {title: "Deep", text: "When your space needs a thorough reset.", items: ["Everything in regular cleaning", "Doors, skirting boards and switches", "Cabinet fronts and difficult zones", "More time for kitchen and bathroom"]}},
  pricing: {...ru.pricing, eyebrow: "Transparent prices", title: "A clear range before you book", body: "Pricing depends on size and condition. These are estimates for spaces without extreme soiling.", area: ["up to 40 m²", "41–60 m²", "61–80 m²", "81–100 m²", "100+ m²"], from: "from", note: "Minimum order is 4,000 RSD. Windows, appliance interiors and heavy soiling are priced separately.", serviceNames: {regular: "Regular", deep: "Deep", move: "Move-in / out", airbnb: "Airbnb / rental", office: "Office"}},
  calculator: {...ru.calculator, eyebrow: "Calculator", title: "Build your cleaning plan", body: "This is an estimate — we confirm the final price after a short description or photos.", service: "Cleaning type", area: "Area", extras: "Extra services", result: "Estimated total", from: "from", note: "Cash · no deposit", book: "Send estimate", urgent: "Urgent same-day visit (+20%)", labels: {standardWindow: "Standard window", largeWindow: "Large window", balcony: "Balcony / terrace", fridge: "Inside fridge", oven: "Inside oven", cabinets: "Inside cabinets", ironing: "Ironing · 30 minutes", steam: "Eco steam", petHair: "Heavy pet hair", linen: "Linen change"}},
  process: {eyebrow: "How it works", title: "From message to a clean home", steps: [{number: "01", title: "Tell us about the space", text: "Area, district, cleaning type and, if convenient, a few photos."}, {number: "02", title: "Get a confirmed price", text: "We confirm the details and cost before the visit."}, {number: "03", title: "Choose a time", text: "Weekend and same-day visits may be available."}, {number: "04", title: "We take care of it", text: "Check the result after cleaning and pay in cash."}]},
  assurance: {eyebrow: "Peace of mind", title: "Honest terms with no fine print", items: [{title: "Price before we start", text: "Scope and cost are agreed upfront."}, {title: "Our products or yours", text: "We adapt to your preferences and surfaces."}, {title: "Eco steam", text: "Chemical-free steam for suitable areas."}, {title: "Every district", text: "We cover all of Belgrade, not only convenient addresses."}], unavailable: "We don’t handle", unavailableItems: ["post-renovation cleaning", "mould or flood damage", "hazardous contamination", "building façades or industrial cleaning"]},
  faq: {eyebrow: "FAQ", title: "The essentials", items: [{q: "Can I book for today?", a: "Yes, if a time slot is available. An urgent same-day visit adds 20% to the price."}, {q: "Do I need to buy cleaning products?", a: "No. We can bring our own or use yours — whichever you prefer."}, {q: "Is the calculator price final?", a: "It is a working estimate. We confirm the final price after a description or photos of the space."}, {q: "Do you clean windows?", a: "Yes. A standard window is 950 RSD; large or panoramic windows start at 1,300 RSD."}, {q: "How do I pay?", a: "Cash after the cleaning is complete. No deposit is required."}]},
  contact: {eyebrow: "Ready?", title: "Tell us the size. We’ll calculate the rest.", body: "We’ll reply quickly, confirm the details and suggest the nearest available time.", messenger: "Or message us directly"},
  footer: {tagline: "Careful cleaning across Belgrade.", location: "Belgrade · all districts", rights: "All rights reserved", privacy: "Privacy", terms: "Terms"}
};

export const siteContent: Record<Locale, SiteContent> = {ru, sr, en};
