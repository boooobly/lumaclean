import type {Locale} from "@/i18n/routing";
import type {ServiceId} from "@/lib/pricing";

export type ServiceSeoContent = {
  slug: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  lead: string;
  intro: string[];
  included: string[];
  suitable: string[];
  details: {title: string; text: string}[];
  faq: {q: string; a: string}[];
  image: string;
  imageAlt: string;
};

export const servicePageUi: Record<Locale, {
  home: string;
  services: string;
  included: string;
  includedLead: string;
  suitable: string;
  details: string;
  process: string;
  faq: string;
  related: string;
  priceFrom: string;
  priceNote: string;
  estimate: string;
  allBelgrade: string;
  navLabel: string;
}> = {
  ru: {
    home: "Главная",
    services: "Услуги",
    included: "Что входит в уборку",
    includedLead: "Точный состав фиксируем до выезда. Дополнительные работы всегда видны отдельно в расчёте.",
    suitable: "Когда подходит",
    details: "Как устроена услуга",
    process: "От заявки до результата",
    faq: "Вопросы об услуге",
    related: "Другие форматы уборки",
    priceFrom: "Стоимость от",
    priceNote: "Финальная цена зависит от площади, состояния и выбранных дополнений.",
    estimate: "Рассчитать уборку",
    allBelgrade: "Выезжаем во все районы Белграда",
    navLabel: "Услуги LumaClean",
  },
  sr: {
    home: "Početna",
    services: "Usluge",
    included: "Šta obuhvata čišćenje",
    includedLead: "Tačan obim potvrđujemo pre dolaska. Dodatni radovi su uvek posebno prikazani u obračunu.",
    suitable: "Kada je pravi izbor",
    details: "Kako je usluga organizovana",
    process: "Od upita do rezultata",
    faq: "Pitanja o usluzi",
    related: "Drugi tipovi čišćenja",
    priceFrom: "Cena od",
    priceNote: "Konačna cena zavisi od kvadrature, stanja prostora i izabranih dodataka.",
    estimate: "Izračunajte cenu",
    allBelgrade: "Dolazimo u sve delove Beograda",
    navLabel: "LumaClean usluge",
  },
  en: {
    home: "Home",
    services: "Services",
    included: "What is included",
    includedLead: "We confirm the exact scope before arrival. Extra work is always shown separately in your estimate.",
    suitable: "When it fits",
    details: "How the service works",
    process: "From enquiry to result",
    faq: "Service questions",
    related: "Other cleaning options",
    priceFrom: "Prices from",
    priceNote: "The final price depends on area, condition and selected extras.",
    estimate: "Estimate your cleaning",
    allBelgrade: "Available across all Belgrade districts",
    navLabel: "LumaClean services",
  },
};

export const serviceSeoContent: Record<Locale, Record<ServiceId, ServiceSeoContent>> = {
  ru: {
    regular: {
      slug: "uborka-kvartir",
      title: "Уборка квартир в Белграде — цены от 4 000 RSD | LumaClean",
      description: "Поддерживающая уборка квартир по всему Белграду: комнаты, кухня, санузел и полы. Цена от 4 000 RSD, расчёт до выезда.",
      eyebrow: "Регулярный уход · Белград",
      h1: "Поддерживающая уборка квартир в Белграде",
      lead: "Возвращаем квартире аккуратный повседневный вид: убираем пыль, моем полы, приводим в порядок кухню, санузел и зеркала.",
      intro: [
        "Поддерживающая уборка подходит квартире без сильных и застарелых загрязнений. Это понятный формат для регулярного ухода раз в неделю, раз в две недели или перед приходом гостей.",
        "До выезда мы уточняем площадь, район и состояние помещений. Вы заранее видите ориентир по цене и можете отдельно добавить окна, балкон, духовку, холодильник, шкафы или смену белья.",
      ],
      included: ["Удаление пыли с доступных открытых поверхностей", "Пылесос и влажная уборка полов", "Очистка кухонных фасадов и рабочих поверхностей снаружи", "Уборка санузла, сантехники и зеркал", "Вынос бытового мусора по договорённости", "Аккуратный финальный порядок в комнатах"],
      suitable: ["Для регулярного ухода за квартирой", "Перед приходом гостей или после насыщенной недели", "Когда глубокая генеральная уборка пока не требуется"],
      details: [
        {title: "Кухня и санузел", text: "Основное внимание уделяем зонам ежедневного использования: удаляем свежие следы, жир с доступных поверхностей, капли воды и мыльный налёт."},
        {title: "Понятная цена", text: "Ориентир зависит от площади. Если есть шерсть животных, сильные загрязнения или дополнительные работы, они согласуются до начала уборки."},
        {title: "Средства", text: "Можем приехать со своими средствами или использовать ваши. Для подходящих поверхностей доступна паровая обработка без бытовой химии."},
      ],
      faq: [
        {q: "Сколько стоит уборка квартиры в Белграде?", a: "Поддерживающая уборка стоит от 4 000 RSD. Точный ориентир зависит от площади, состояния квартиры и дополнительных работ."},
        {q: "Можно заказать уборку в день обращения?", a: "Да, если есть свободное окно. Для срочного выезда в тот же день к стоимости добавляется 20%."},
        {q: "Входит ли мойка окон?", a: "Окна добавляются отдельно: стандартное окно — 900 RSD, большое или панорамное — от 1 200 RSD."},
        {q: "Нужно ли покупать чистящие средства?", a: "Нет. Мы можем приехать со своими средствами или использовать ваши — как удобнее и безопаснее для поверхностей."},
      ],
      image: "/media/living-room-clean.jpg",
      imageAlt: "Чистая гостиная после поддерживающей уборки квартиры в Белграде",
    },
    deep: {
      slug: "generalnaya-uborka",
      title: "Генеральная уборка в Белграде — от 9 300 RSD | LumaClean",
      description: "Генеральная уборка квартир в Белграде: кухня, ванная, двери, плинтусы и сложные зоны. Стоимость от 9 300 RSD.",
      eyebrow: "Глубокая уборка · Белград",
      h1: "Генеральная уборка квартир в Белграде",
      lead: "Подробно прорабатываем кухню, ванную, двери, плинтусы, выключатели и зоны, которым не хватает обычной регулярной уборки.",
      intro: [
        "Генеральная уборка нужна после долгого перерыва, перед важным событием или когда квартире требуется основательный перезапуск. На работу закладывается больше времени, чем на поддерживающий формат.",
        "Мы заранее обсуждаем загрязнения и границы задачи. Внутреннюю мойку техники, шкафов, окна, балкон и паровую обработку можно добавить к основному составу.",
      ],
      included: ["Всё из поддерживающей уборки", "Двери, ручки, выключатели и плинтусы", "Более детальная работа с кухней и санузлом", "Очистка мебельных фасадов снаружи", "Пыль в доступных труднодоступных зонах", "Точечная работа с известковым и мыльным налётом"],
      suitable: ["После долгого перерыва в уборке", "Перед праздником, приездом семьи или сдачей квартиры", "Когда кухня и ванная требуют больше времени и внимания"],
      details: [
        {title: "Без скрытого объёма", text: "По описанию и фотографиям оцениваем состояние заранее. Если задача выходит за стандартный объём, согласуем это до выезда."},
        {title: "Бережная обработка", text: "Подбираем способ под материал: металл, стекло, плитку, мебельные фасады и окрашенные поверхности не обрабатываются одной универсальной химией."},
        {title: "Что считается отдельно", text: "Окна, внутренние поверхности духовки, холодильника и шкафов, балкон, сильная шерсть и eco steam отображаются отдельными позициями."},
      ],
      faq: [
        {q: "Чем генеральная уборка отличается от поддерживающей?", a: "Она занимает больше времени и включает двери, плинтусы, выключатели, фасады и более подробную работу с кухней и санузлом."},
        {q: "Сколько стоит генеральная уборка?", a: "Цена начинается от 9 300 RSD и зависит от площади, состояния квартиры и выбранных дополнительных работ."},
        {q: "Убираете после ремонта?", a: "Нет. Строительную пыль, следы краски, клея и другие последствия ремонта мы не берём в работу."},
        {q: "Можно добавить духовку и холодильник?", a: "Да. Мойка внутри духовки стоит 1 100 RSD, холодильника — 900 RSD."},
      ],
      image: "/media/material-chrome.webp",
      imageAlt: "Бережно очищенный смеситель после генеральной уборки",
    },
    move: {
      slug: "uborka-pri-pereezde",
      title: "Уборка квартиры при переезде в Белграде | LumaClean",
      description: "Уборка перед въездом или после выезда из квартиры в Белграде. Подготовим пустое пространство к заселению или передаче владельцу.",
      eyebrow: "Въезд и выезд · Белград",
      h1: "Уборка квартиры перед въездом или после выезда",
      lead: "Подготавливаем пустую квартиру к новому жильцу: последовательно очищаем комнаты, кухню, санузел и согласованные внутренние зоны.",
      intro: [
        "Пустая квартира позволяет добраться до поверхностей, которые обычно закрыты мебелью и вещами. Формат подходит перед заселением, после окончания аренды или перед передачей ключей владельцу.",
        "Мы уточняем, какие шкафы и приборы остаются в квартире, нужны ли окна и балкон. Это помогает зафиксировать реальный объём и избежать сюрпризов в день уборки.",
      ],
      included: ["Пыль и загрязнения на доступных поверхностях пустой квартиры", "Пылесос и влажная уборка полов", "Кухонные фасады и рабочая зона снаружи", "Санузел, сантехника, зеркала и стекло", "Двери, ручки, выключатели и плинтусы", "Финальная проверка согласованных зон"],
      suitable: ["Перед заселением в арендованную или купленную квартиру", "После вывоза вещей перед возвратом ключей", "Для подготовки объекта к новому арендатору"],
      details: [
        {title: "Лучше после вывоза вещей", text: "Максимальный результат получается, когда коробки и личные предметы уже вывезены, а ко всем согласованным поверхностям есть доступ."},
        {title: "Внутренние зоны", text: "Шкафы, холодильник и духовка внутри добавляются отдельно. Мы фиксируем их количество и состояние до подтверждения цены."},
        {title: "Не после ремонта", text: "Этот формат рассчитан на бытовые загрязнения после проживания. Строительная пыль и остатки материалов требуют другой технологии."},
      ],
      faq: [
        {q: "Когда лучше заказывать уборку при переезде?", a: "После вывоза вещей и до передачи ключей. Так у команды будет доступ к полу, плинтусам и пустым поверхностям."},
        {q: "Вы моете шкафы внутри?", a: "Да, это можно добавить в расчёт. Внутренняя мойка шкафов стоит от 900 RSD за выбранный объём."},
        {q: "Можно включить окна и балкон?", a: "Да. Они считаются отдельно по количеству и размеру окон, а также состоянию балкона или террасы."},
        {q: "Сколько стоит уборка перед въездом?", a: "Стоимость начинается от 10 200 RSD. Финальный ориентир зависит от площади и списка внутренних зон."},
      ],
      image: "/media/kitchen-clean.webp",
      imageAlt: "Чистая кухня в квартире, подготовленной к переезду",
    },
    airbnb: {
      slug: "uborka-airbnb",
      title: "Уборка Airbnb и апартаментов в Белграде | LumaClean",
      description: "Уборка Airbnb-апартаментов между гостями в Белграде: комнаты, санузел, кухня и смена белья по запросу. От 4 000 RSD.",
      eyebrow: "Апартаменты · Белград",
      h1: "Уборка Airbnb между гостями в Белграде",
      lead: "Готовим апартамент к следующему заезду по согласованному чек-листу и времени: уборка, финальный вид и смена подготовленного белья.",
      intro: [
        "Для краткосрочной аренды важны предсказуемость и аккуратный результат к моменту заселения. Мы работаем по согласованному составу, чтобы ключевые зоны выглядели одинаково хорошо после каждого визита.",
        "Можно добавить смену постельного белья, балкон, внутреннюю мойку техники и другие конкретные работы. Стирка и доставка расходников обсуждаются отдельно и не входят в базовый расчёт.",
      ],
      included: ["Уборка комнат и доступных поверхностей", "Пылесос и влажная уборка полов", "Кухонная рабочая зона и фасады снаружи", "Санузел, сантехника, зеркало и стекло", "Финальная проверка визуального порядка", "Смена подготовленного белья как дополнительная услуга"],
      suitable: ["Между выездом и заездом гостей", "Для апартаментов краткосрочной аренды", "Когда нужен повторяемый согласованный чек-лист"],
      details: [
        {title: "Работа ко времени", text: "При заявке укажите время выезда и следующего заезда. Мы подтвердим доступный слот до принятия заказа."},
        {title: "Согласованный чек-лист", text: "Фиксируем обязательные зоны и дополнительные задачи для конкретного апартамента, чтобы состав не менялся от визита к визиту."},
        {title: "Дополнения", text: "Смена подготовленного белья, духовка, холодильник, балкон и окна добавляются в расчёт отдельными строками."},
      ],
      faq: [
        {q: "Можно заказать уборку к точному времени заезда?", a: "Мы учитываем окно между гостями и подтверждаем время до заказа. Срочный выезд зависит от свободных слотов."},
        {q: "Меняете постельное бельё?", a: "Да, если чистый комплект подготовлен в апартаменте. Стоимость смены — 750 RSD."},
        {q: "Вы стираете бельё и пополняете расходники?", a: "Это не входит в базовую услугу. Такие задачи можно отдельно описать в комментарии для согласования."},
        {q: "Сколько стоит уборка Airbnb?", a: "Базовый ориентир начинается от 4 000 RSD и зависит от площади, состояния и согласованного чек-листа."},
      ],
      image: "/media/material-textile.webp",
      imageAlt: "Аккуратно подготовленный текстиль в апартаментах Airbnb",
    },
    office: {
      slug: "uborka-ofisov",
      title: "Уборка небольших офисов в Белграде | LumaClean",
      description: "Регулярная и разовая уборка небольших офисов в Белграде: рабочие поверхности, полы, санузел и coffee point. От 4 000 RSD.",
      eyebrow: "Небольшие офисы · Белград",
      h1: "Уборка небольших офисов в Белграде",
      lead: "Поддерживаем порядок в компактных рабочих пространствах: доступные столы, полы, санузел, coffee point и бытовой мусор.",
      intro: [
        "Услуга рассчитана на небольшие офисы без промышленного загрязнения и специализированных зон. Возможна разовая уборка или согласованный регулярный график.",
        "Перед первым визитом уточняем площадь, количество рабочих мест, санузлов и удобное время. Для регулярного формата состав работ фиксируется заранее.",
      ],
      included: ["Удаление пыли с доступных рабочих поверхностей", "Пылесос и влажная уборка полов", "Уборка санузла и зеркал", "Очистка coffee point снаружи", "Сбор бытового мусора в согласованных зонах", "Протирка дверных ручек и доступных выключателей"],
      suitable: ["Для небольших офисов и студий", "Для разовой уборки или регулярного графика", "Когда важен заранее зафиксированный состав работ"],
      details: [
        {title: "Без помех работе", text: "Согласуем удобное время и зоны доступа. Документы, технику и личные вещи сотрудников не перемещаем без отдельной договорённости."},
        {title: "Регулярный формат", text: "После первого визита можно закрепить чек-лист и периодичность. Изменения в составе работ подтверждаются заранее."},
        {title: "Границы услуги", text: "Не выполняем промышленный клининг, фасадные работы, уборку опасных загрязнений и специализированных производственных помещений."},
      ],
      faq: [
        {q: "Работаете ли вы по регулярному графику?", a: "Да, для небольшого офиса можно согласовать повторяющийся чек-лист и удобную периодичность."},
        {q: "Можно провести уборку вне рабочего времени?", a: "Укажите желаемое время в заявке. Мы подтвердим доступный слот до выезда."},
        {q: "Вы убираете большие коммерческие объекты?", a: "Нет. Мы специализируемся на небольших офисах и не выполняем промышленный или фасадный клининг."},
        {q: "От чего зависит цена?", a: "От площади, количества санузлов и рабочих зон, состояния помещения, частоты визитов и дополнительных работ."},
      ],
      image: "/media/material-cabinet.webp",
      imageAlt: "Чистая рабочая зона небольшого офиса в Белграде",
    },
  },
  sr: {
    regular: {
      slug: "ciscenje-stanova",
      title: "Čišćenje stanova Beograd — cena od 4.000 RSD | LumaClean",
      description: "Održavajuće čišćenje stanova u svim delovima Beograda: sobe, kuhinja, kupatilo i podovi. Cena od 4.000 RSD.",
      eyebrow: "Redovno održavanje · Beograd",
      h1: "Održavajuće čišćenje stanova u Beogradu",
      lead: "Vraćamo stanu uredan svakodnevni izgled: brišemo prašinu, čistimo podove, kuhinju, kupatilo i ogledala.",
      intro: [
        "Održavajuće čišćenje je namenjeno stanu bez jakih i starih zaprljanja. Dobar je izbor za negu jednom nedeljno, na dve nedelje ili pre dolaska gostiju.",
        "Pre dolaska proveravamo kvadraturu, deo grada i stanje prostora. Unapred vidite okvirnu cenu, a prozore, balkon, rernu, frižider, ormariće ili promenu posteljine dodajete po potrebi.",
      ],
      included: ["Brisanje prašine sa dostupnih otvorenih površina", "Usisavanje i vlažno čišćenje podova", "Kuhinjski frontovi i radne površine spolja", "Kupatilo, sanitarije i ogledala", "Odnošenje kućnog otpada po dogovoru", "Završno sređivanje prostorija"],
      suitable: ["Za redovno održavanje stana", "Pre dolaska gostiju ili nakon naporne nedelje", "Kada detaljno generalno čišćenje još nije potrebno"],
      details: [
        {title: "Kuhinja i kupatilo", text: "Fokusiramo se na svakodnevno korišćene zone: uklanjamo sveže tragove, masnoću sa dostupnih površina, kapljice i naslage sapuna."},
        {title: "Jasna cena", text: "Okvir zavisi od kvadrature. Dlake kućnih ljubimaca, jača zaprljanja i dodatni radovi potvrđuju se pre početka."},
        {title: "Sredstva", text: "Možemo doneti svoja sredstva ili koristiti vaša. Za odgovarajuće površine dostupna je i parna obrada bez kućne hemije."},
      ],
      faq: [
        {q: "Koliko košta čišćenje stana u Beogradu?", a: "Održavajuće čišćenje počinje od 4.000 RSD. Tačan okvir zavisi od kvadrature, stanja i dodatnih radova."},
        {q: "Mogu li da zakažem čišćenje istog dana?", a: "Da, ako postoji slobodan termin. Hitni dolazak istog dana uvećava cenu za 20%."},
        {q: "Da li su prozori uključeni?", a: "Prozori se dodaju posebno: standardni je 900 RSD, a veliki ili panoramski od 1.200 RSD."},
        {q: "Da li moram da kupim sredstva?", a: "Ne. Možemo doneti svoja sredstva ili koristiti vaša, u zavisnosti od vaših želja i površina."},
      ],
      image: "/media/living-room-clean.jpg",
      imageAlt: "Čista dnevna soba nakon održavajućeg čišćenja stana u Beogradu",
    },
    deep: {
      slug: "generalno-ciscenje",
      title: "Generalno čišćenje Beograd — od 9.300 RSD | LumaClean",
      description: "Generalno čišćenje stanova u Beogradu: kuhinja, kupatilo, vrata, lajsne i zahtevne zone. Cena od 9.300 RSD.",
      eyebrow: "Detaljno čišćenje · Beograd",
      h1: "Generalno čišćenje stanova u Beogradu",
      lead: "Detaljno obrađujemo kuhinju, kupatilo, vrata, lajsne, prekidače i zone kojima redovno čišćenje nije dovoljno.",
      intro: [
        "Generalno čišćenje je pravi izbor nakon duže pauze, pre važnog događaja ili kada je stanu potreban temeljni novi početak. Za njega planiramo više vremena nego za održavajuću uslugu.",
        "Pre dolaska razgovaramo o zaprljanjima i granicama posla. Unutrašnjost uređaja i ormarića, prozori, balkon i parna obrada mogu se dodati osnovnom obimu.",
      ],
      included: ["Sve iz održavajućeg čišćenja", "Vrata, kvake, prekidači i lajsne", "Detaljniji rad u kuhinji i kupatilu", "Spoljašnje čišćenje frontova nameštaja", "Prašina u dostupnim zahtevnim zonama", "Ciljana obrada kamenca i naslaga sapuna"],
      suitable: ["Nakon duže pauze u čišćenju", "Pre proslave, dolaska porodice ili izdavanja stana", "Kada kuhinja i kupatilo traže više vremena"],
      details: [
        {title: "Obim bez iznenađenja", text: "Na osnovu opisa i fotografija unapred procenjujemo stanje. Sve što izlazi iz standardnog obima dogovaramo pre dolaska."},
        {title: "Pažljiva obrada", text: "Način rada biramo prema materijalu: metal, staklo, pločice, frontovi i obojene površine ne tretiraju se jednim univerzalnim sredstvom."},
        {title: "Posebno se obračunava", text: "Prozori, unutrašnjost rerne, frižidera i ormarića, balkon, mnogo dlaka i eco steam prikazuju se kao posebne stavke."},
      ],
      faq: [
        {q: "Koja je razlika između generalnog i održavajućeg čišćenja?", a: "Generalno traje duže i obuhvata vrata, lajsne, prekidače, frontove i detaljniji rad u kuhinji i kupatilu."},
        {q: "Koliko košta generalno čišćenje?", a: "Cena počinje od 9.300 RSD i zavisi od kvadrature, stanja stana i dodatnih radova."},
        {q: "Da li čistite nakon renoviranja?", a: "Ne. Građevinska prašina, boja, lepak i ostaci materijala nisu deo naših usluga."},
        {q: "Mogu li da dodam rernu i frižider?", a: "Da. Rerna iznutra je 1.100 RSD, a frižider iznutra 900 RSD."},
      ],
      image: "/media/material-chrome.webp",
      imageAlt: "Pažljivo očišćena slavina nakon generalnog čišćenja",
    },
    move: {
      slug: "ciscenje-pri-selidbi",
      title: "Čišćenje stana pri useljenju i iseljenju Beograd | LumaClean",
      description: "Čišćenje praznog stana pre useljenja ili nakon iseljenja u Beogradu. Priprema prostora za stanare ili predaju ključeva.",
      eyebrow: "Useljenje i iseljenje · Beograd",
      h1: "Čišćenje stana pre useljenja ili nakon iseljenja",
      lead: "Pripremamo prazan stan za novog stanara: redom čistimo sobe, kuhinju, kupatilo i dogovorene unutrašnje zone.",
      intro: [
        "U praznom stanu dostupne su površine koje su obično zaklonjene nameštajem i stvarima. Usluga odgovara periodu pre useljenja, nakon završetka najma ili pre predaje ključeva vlasniku.",
        "Proveravamo koji ormarići i uređaji ostaju, kao i da li su potrebni prozori i balkon. Tako utvrđujemo stvarni obim pre dana čišćenja.",
      ],
      included: ["Prašina i tragovi na dostupnim površinama praznog stana", "Usisavanje i vlažno čišćenje podova", "Kuhinjski frontovi i radna zona spolja", "Kupatilo, sanitarije, ogledala i staklo", "Vrata, kvake, prekidači i lajsne", "Završna provera dogovorenih zona"],
      suitable: ["Pre useljenja u iznajmljen ili kupljen stan", "Nakon iznošenja stvari, pre vraćanja ključeva", "Za pripremu stana za sledećeg zakupca"],
      details: [
        {title: "Nakon iznošenja stvari", text: "Najbolji rezultat se postiže kada su kutije i lični predmeti uklonjeni i sve dogovorene površine dostupne."},
        {title: "Unutrašnje zone", text: "Ormarići, frižider i rerna iznutra dodaju se posebno. Količinu i stanje potvrđujemo pre konačne cene."},
        {title: "Nije post-renovation", text: "Ova usluga je namenjena kućnim tragovima nakon stanovanja. Građevinska prašina i materijali traže drugačiju tehnologiju."},
      ],
      faq: [
        {q: "Kada je najbolje zakazati čišćenje pri selidbi?", a: "Nakon iznošenja stvari i pre predaje ključeva, kako bi podovi, lajsne i prazne površine bili dostupni."},
        {q: "Da li čistite ormariće iznutra?", a: "Da, to možete dodati obračunu. Cena počinje od 900 RSD za dogovoreni obim."},
        {q: "Mogu li da uključim prozore i balkon?", a: "Da. Posebno se obračunavaju prema broju i veličini prozora i stanju balkona ili terase."},
        {q: "Koliko košta čišćenje pre useljenja?", a: "Cena počinje od 10.200 RSD i zavisi od kvadrature i spiska unutrašnjih zona."},
      ],
      image: "/media/kitchen-clean.webp",
      imageAlt: "Čista kuhinja u stanu pripremljenom za useljenje",
    },
    airbnb: {
      slug: "ciscenje-airbnb-apartmana",
      title: "Čišćenje Airbnb apartmana u Beogradu | LumaClean",
      description: "Čišćenje Airbnb apartmana između gostiju u Beogradu: sobe, kupatilo, kuhinja i promena pripremljene posteljine. Od 4.000 RSD.",
      eyebrow: "Apartmani · Beograd",
      h1: "Čišćenje Airbnb apartmana između gostiju",
      lead: "Pripremamo apartman za sledeći dolazak prema dogovorenoj listi i terminu: čišćenje, završni izgled i promena pripremljene posteljine.",
      intro: [
        "Kod kratkoročnog najma važni su predvidljivost i uredan rezultat do check-in vremena. Radimo prema dogovorenom obimu kako bi ključne zone izgledale dosledno nakon svakog dolaska.",
        "Možete dodati promenu posteljine, balkon, unutrašnjost uređaja i druge konkretne zadatke. Pranje veša i nabavka potrošnog materijala nisu deo osnovnog obračuna.",
      ],
      included: ["Čišćenje soba i dostupnih površina", "Usisavanje i vlažno čišćenje podova", "Kuhinjska radna zona i frontovi spolja", "Kupatilo, sanitarije, ogledalo i staklo", "Završna provera vizuelnog reda", "Promena pripremljene posteljine kao dodatak"],
      suitable: ["Između odlaska i dolaska gostiju", "Za apartmane sa kratkoročnim najmom", "Kada je potrebna ponovljiva dogovorena lista"],
      details: [
        {title: "Rad prema terminu", text: "U upitu navedite vreme check-outa i sledećeg check-ina. Dostupan termin potvrđujemo pre prihvatanja posla."},
        {title: "Dogovorena lista", text: "Definišemo obavezne zone i dodatke za konkretan apartman kako bi obim ostao jasan pri svakoj poseti."},
        {title: "Dodaci", text: "Promena pripremljene posteljine, rerna, frižider, balkon i prozori prikazuju se kao posebne stavke."},
      ],
      faq: [
        {q: "Mogu li da zakažem čišćenje prema tačnom check-in terminu?", a: "Uzimamo u obzir period između gostiju i potvrđujemo vreme pre naručivanja. Hitni termin zavisi od raspoloživosti."},
        {q: "Da li menjate posteljinu?", a: "Da, ako je čist komplet pripremljen u apartmanu. Cena promene je 750 RSD."},
        {q: "Da li perete veš i dopunjavate potrošni materijal?", a: "To nije deo osnovne usluge. Ove zadatke možete navesti u komentaru radi posebnog dogovora."},
        {q: "Koliko košta čišćenje Airbnb apartmana?", a: "Osnovna cena počinje od 4.000 RSD i zavisi od kvadrature, stanja i dogovorene liste."},
      ],
      image: "/media/material-textile.webp",
      imageAlt: "Uredno pripremljen tekstil u Airbnb apartmanu",
    },
    office: {
      slug: "ciscenje-kancelarija",
      title: "Čišćenje kancelarija Beograd | LumaClean",
      description: "Redovno i jednokratno čišćenje manjih kancelarija u Beogradu: radne površine, podovi, kupatilo i coffee point. Od 4.000 RSD.",
      eyebrow: "Male kancelarije · Beograd",
      h1: "Čišćenje manjih kancelarija u Beogradu",
      lead: "Održavamo red u manjim radnim prostorima: dostupni stolovi, podovi, kupatilo, coffee point i kućni otpad.",
      intro: [
        "Usluga je namenjena manjim kancelarijama bez industrijskih zaprljanja i specijalizovanih zona. Moguća je jednokratna poseta ili dogovoreni redovan raspored.",
        "Pre prvog dolaska proveravamo kvadraturu, broj radnih mesta, kupatila i pogodno vreme. Za redovan rad unapred definišemo listu zadataka.",
      ],
      included: ["Brisanje prašine sa dostupnih radnih površina", "Usisavanje i vlažno čišćenje podova", "Čišćenje kupatila i ogledala", "Spoljašnje čišćenje coffee pointa", "Sakupljanje kućnog otpada u dogovorenim zonama", "Brisanje kvaka i dostupnih prekidača"],
      suitable: ["Za manje kancelarije i studije", "Za jednokratno čišćenje ili redovan raspored", "Kada je važan unapred definisan obim"],
      details: [
        {title: "Bez ometanja rada", text: "Dogovaramo vreme i zone pristupa. Dokumenta, opremu i lične stvari zaposlenih ne pomeramo bez posebnog dogovora."},
        {title: "Redovan format", text: "Nakon prve posete možemo definisati listu i učestalost. Sve izmene obima potvrđuju se unapred."},
        {title: "Granice usluge", text: "Ne radimo industrijsko čišćenje, fasade, opasna zaprljanja ni specijalizovane proizvodne prostore."},
      ],
      faq: [
        {q: "Da li radite po redovnom rasporedu?", a: "Da, za manju kancelariju možemo dogovoriti ponavljajuću listu i odgovarajuću učestalost."},
        {q: "Može li čišćenje van radnog vremena?", a: "Navedite željeno vreme u upitu. Dostupan termin potvrđujemo pre dolaska."},
        {q: "Da li čistite velike poslovne objekte?", a: "Ne. Specijalizovani smo za manje kancelarije i ne pružamo industrijsko ili fasadno čišćenje."},
        {q: "Od čega zavisi cena?", a: "Od kvadrature, broja kupatila i radnih zona, stanja prostora, učestalosti i dodatnih radova."},
      ],
      image: "/media/material-cabinet.webp",
      imageAlt: "Čista radna zona manje kancelarije u Beogradu",
    },
  },
  en: {
    regular: {
      slug: "apartment-cleaning",
      title: "Apartment Cleaning Belgrade — from 4,000 RSD | LumaClean",
      description: "Regular apartment cleaning across Belgrade: rooms, kitchen, bathroom and floors. Prices from 4,000 RSD with an upfront estimate.",
      eyebrow: "Regular home care · Belgrade",
      h1: "Apartment cleaning in Belgrade",
      lead: "We restore a calm everyday finish: dusting, floors, kitchen exteriors, bathroom fixtures and mirrors.",
      intro: [
        "Regular cleaning suits a home without heavy or long-standing soiling. It works well weekly, every two weeks or before guests arrive.",
        "Before the visit, we confirm the area, district and condition. You see a price guide upfront and can add windows, balcony, oven, fridge, cabinets or linen change separately.",
      ],
      included: ["Dusting accessible open surfaces", "Vacuuming and wet floor cleaning", "Kitchen fronts and work surfaces from the outside", "Bathroom fixtures and mirrors", "Household waste removal by agreement", "A calm final tidy in each room"],
      suitable: ["For ongoing apartment care", "Before guests or after a busy week", "When a full deep clean is not yet needed"],
      details: [
        {title: "Kitchen and bathroom", text: "We focus on the areas used every day, removing fresh marks, grease from accessible surfaces, water droplets and soap residue."},
        {title: "Clear pricing", text: "The guide depends on floor area. Pet hair, heavier soiling and extra work are confirmed before cleaning begins."},
        {title: "Products", text: "We can bring our products or use yours. Chemical-free steam treatment is available for suitable surfaces."},
      ],
      faq: [
        {q: "How much does apartment cleaning cost in Belgrade?", a: "Regular cleaning starts at 4,000 RSD. The exact guide depends on floor area, condition and selected extras."},
        {q: "Can I book a same-day clean?", a: "Yes, when a slot is available. An urgent same-day visit adds 20% to the price."},
        {q: "Are windows included?", a: "Windows are added separately: 900 RSD for a standard window and from 1,200 RSD for a large or panoramic one."},
        {q: "Do I need to buy cleaning products?", a: "No. We can bring our own or use yours, depending on your preferences and the surfaces in your home."},
      ],
      image: "/media/living-room-clean.jpg",
      imageAlt: "Clean living room after regular apartment cleaning in Belgrade",
    },
    deep: {
      slug: "deep-cleaning",
      title: "Deep Cleaning Belgrade — from 9,300 RSD | LumaClean",
      description: "Deep apartment cleaning in Belgrade covering kitchen, bathroom, doors, skirting boards and difficult zones. From 9,300 RSD.",
      eyebrow: "Detailed cleaning · Belgrade",
      h1: "Deep apartment cleaning in Belgrade",
      lead: "We give the kitchen, bathroom, doors, skirting boards, switches and overlooked zones more time and detailed attention.",
      intro: [
        "Deep cleaning is designed for a home after a long break, before an important occasion or whenever regular maintenance is no longer enough. It takes more time than a standard visit.",
        "We discuss the condition and boundaries in advance. Appliance and cabinet interiors, windows, balcony and steam treatment can be added to the core scope.",
      ],
      included: ["Everything in regular cleaning", "Doors, handles, switches and skirting boards", "More detailed kitchen and bathroom work", "Furniture fronts from the outside", "Dust in accessible difficult areas", "Focused treatment of limescale and soap residue"],
      suitable: ["After a longer gap between cleans", "Before a celebration, family visit or rental handover", "When the kitchen and bathroom need more time"],
      details: [
        {title: "No hidden scope", text: "We assess the condition from your description and photos. Work beyond the standard scope is agreed before the visit."},
        {title: "Surface-aware care", text: "We match the method to the material rather than treating metal, glass, tile, fronts and painted surfaces with one universal product."},
        {title: "Priced separately", text: "Windows, oven, fridge and cabinet interiors, balcony, heavy pet hair and eco steam appear as separate estimate lines."},
      ],
      faq: [
        {q: "How is deep cleaning different from regular cleaning?", a: "It allows more time for doors, skirting boards, switches, fronts and detailed kitchen and bathroom work."},
        {q: "How much does deep cleaning cost?", a: "Prices start at 9,300 RSD and depend on area, apartment condition and selected extras."},
        {q: "Do you clean after renovation?", a: "No. Construction dust, paint, adhesive and building material residue require a different specialist service."},
        {q: "Can I add the oven and fridge?", a: "Yes. Oven interior cleaning is 1,100 RSD and fridge interior cleaning is 900 RSD."},
      ],
      image: "/media/material-chrome.webp",
      imageAlt: "Carefully cleaned fixture after a deep apartment clean",
    },
    move: {
      slug: "move-in-move-out-cleaning",
      title: "Move-in & Move-out Cleaning Belgrade | LumaClean",
      description: "Empty apartment cleaning before move-in or after move-out in Belgrade. Prepare the home for new residents or key handover.",
      eyebrow: "Move-in and move-out · Belgrade",
      h1: "Move-in and move-out apartment cleaning",
      lead: "We prepare an empty home for its next resident, covering the rooms, kitchen, bathroom and agreed interior zones in a clear sequence.",
      intro: [
        "An empty apartment gives access to surfaces normally hidden by furniture and belongings. The service fits the period before moving in, after a tenancy or before returning the keys.",
        "We confirm which cabinets and appliances remain and whether windows or balcony are needed. This keeps the real scope clear before cleaning day.",
      ],
      included: ["Dust and marks on accessible empty-home surfaces", "Vacuuming and wet floor cleaning", "Kitchen fronts and work zone from the outside", "Bathroom, fixtures, mirrors and glass", "Doors, handles, switches and skirting boards", "Final check of every agreed zone"],
      suitable: ["Before moving into a rented or purchased home", "After belongings are removed and before key return", "When preparing a property for the next tenant"],
      details: [
        {title: "After belongings leave", text: "The best result is possible once boxes and personal items are removed and every agreed surface is accessible."},
        {title: "Interior zones", text: "Cabinet, fridge and oven interiors are extras. We confirm their quantity and condition before the final estimate."},
        {title: "Not post-renovation", text: "This service covers household traces after occupancy. Construction dust and material residue need a different specialist process."},
      ],
      faq: [
        {q: "When should I schedule move-out cleaning?", a: "After belongings are removed and before key handover, so floors, skirting boards and empty surfaces are accessible."},
        {q: "Do you clean inside cabinets?", a: "Yes, as an extra. Cabinet interior cleaning starts at 900 RSD for the agreed scope."},
        {q: "Can windows and balcony be included?", a: "Yes. They are priced separately by window count and size and by the condition of the balcony or terrace."},
        {q: "How much does move-in cleaning cost?", a: "Prices start at 10,200 RSD and depend on the floor area and list of interior zones."},
      ],
      image: "/media/kitchen-clean.webp",
      imageAlt: "Clean kitchen in a Belgrade apartment prepared for move-in",
    },
    airbnb: {
      slug: "airbnb-cleaning",
      title: "Airbnb Cleaning Belgrade — Guest Turnovers | LumaClean",
      description: "Airbnb apartment cleaning between guests in Belgrade: rooms, bathroom, kitchen and optional prepared linen change. From 4,000 RSD.",
      eyebrow: "Short-term rentals · Belgrade",
      h1: "Airbnb cleaning between guests in Belgrade",
      lead: "We prepare the apartment for the next check-in against an agreed checklist and time window, including an optional prepared linen change.",
      intro: [
        "Short-term rentals depend on a predictable, tidy result before the next guest arrives. We work to an agreed scope so the key areas receive consistent attention on every visit.",
        "You can add prepared linen change, balcony, appliance interiors and other specific work. Laundry and consumable restocking are not part of the base estimate and require separate agreement.",
      ],
      included: ["Rooms and accessible surfaces", "Vacuuming and wet floor cleaning", "Kitchen work zone and fronts from the outside", "Bathroom, fixtures, mirror and glass", "Final visual order check", "Prepared linen change as an optional extra"],
      suitable: ["Between guest check-out and check-in", "For short-term rental apartments", "When a repeatable agreed checklist matters"],
      details: [
        {title: "Timed around guests", text: "Include check-out and next check-in times in your enquiry. We confirm an available slot before accepting the booking."},
        {title: "Agreed checklist", text: "We define the required zones and extras for the apartment, keeping the scope clear from one visit to the next."},
        {title: "Optional extras", text: "Prepared linen change, oven, fridge, balcony and windows are shown as separate lines in the estimate."},
      ],
      faq: [
        {q: "Can cleaning be timed to a specific check-in?", a: "We use the window between guests and confirm timing before booking. Urgent availability depends on open slots."},
        {q: "Do you change bed linen?", a: "Yes, when a clean set is ready in the apartment. Linen change costs 750 RSD."},
        {q: "Do you wash linen and restock supplies?", a: "These tasks are not included in the base service. Add them to your comment so we can discuss them separately."},
        {q: "How much does Airbnb cleaning cost?", a: "The base guide starts at 4,000 RSD and depends on area, condition and the agreed checklist."},
      ],
      image: "/media/material-textile.webp",
      imageAlt: "Neatly prepared textile in an Airbnb apartment in Belgrade",
    },
    office: {
      slug: "office-cleaning",
      title: "Small Office Cleaning Belgrade | LumaClean",
      description: "One-off and regular small office cleaning in Belgrade: work surfaces, floors, bathroom and coffee point. Prices from 4,000 RSD.",
      eyebrow: "Small offices · Belgrade",
      h1: "Small office cleaning in Belgrade",
      lead: "We maintain compact workspaces, including accessible desks, floors, bathroom, coffee point and household waste.",
      intro: [
        "This service is designed for small offices without industrial contamination or specialist areas. Choose a one-off clean or discuss a regular schedule.",
        "Before the first visit, we confirm the floor area, number of workstations, bathrooms and a suitable time. A recurring checklist can then be fixed in advance.",
      ],
      included: ["Dusting accessible work surfaces", "Vacuuming and wet floor cleaning", "Bathroom and mirror cleaning", "Coffee point exteriors", "Household waste collection in agreed areas", "Door handles and accessible switches"],
      suitable: ["For small offices and studios", "For one-off cleaning or a recurring schedule", "When a clearly agreed checklist matters"],
      details: [
        {title: "Minimal disruption", text: "We agree the time and access zones. Documents, equipment and employees' personal items are not moved without prior agreement."},
        {title: "Recurring service", text: "After the first visit, we can fix a checklist and frequency. Any scope changes are confirmed in advance."},
        {title: "Service boundaries", text: "We do not handle industrial cleaning, façades, hazardous contamination or specialist production spaces."},
      ],
      faq: [
        {q: "Can you clean on a recurring schedule?", a: "Yes. For a small office, we can agree a repeatable checklist and suitable frequency."},
        {q: "Can cleaning happen outside office hours?", a: "Add your preferred time to the enquiry. We confirm an available slot before the visit."},
        {q: "Do you clean large commercial buildings?", a: "No. We focus on small offices and do not provide industrial or façade cleaning."},
        {q: "What affects the price?", a: "Floor area, number of bathrooms and work zones, condition, visit frequency and extra work."},
      ],
      image: "/media/material-cabinet.webp",
      imageAlt: "Clean work zone in a small Belgrade office",
    },
  },
};

export function getServicePath(locale: Locale, service: ServiceId) {
  return `/${locale}/services/${serviceSeoContent[locale][service].slug}`;
}

export function findServiceBySlug(locale: Locale, slug: string) {
  const entry = (Object.entries(serviceSeoContent[locale]) as [ServiceId, ServiceSeoContent][]).find(([, value]) => value.slug === slug);
  return entry ? {id: entry[0], content: entry[1]} : null;
}
