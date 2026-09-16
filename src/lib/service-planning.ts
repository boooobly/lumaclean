import type {Locale} from "@/i18n/routing";
import type {ServiceId, extrasPrices} from "@/lib/pricing";

// Examples explain the current tariff; they are not completed jobs or fixed offers.
export const serviceExamples: Record<ServiceId, {area: number; extras: {id: keyof typeof extrasPrices; quantity: number}[]}> = {
  regular: {area: 55, extras: [{id: "standardWindow", quantity: 2}]},
  deep: {area: 55, extras: [{id: "oven", quantity: 1}, {id: "fridge", quantity: 1}]},
  move: {area: 70, extras: [{id: "fridge", quantity: 1}]},
  airbnb: {area: 35, extras: [{id: "linen", quantity: 1}]},
  office: {area: 55, extras: []},
};

type Brief = {title: string; items: [string, string, string]; note: string};
type PlanningUi = {
  navigation: string; prices: string; area: string; base: string; perMetre: string;
  ranges: [string, string, string, string, string]; priceNote: string;
  example: string; exampleNote: string; exampleBase: string; total: string;
  prepare: string; next: string; nextText: string;
};

export const servicePlanningUi: Record<Locale, PlanningUi> = {
  ru: {
    navigation: "На этой странице", prices: "Стоимость по площади", area: "Площадь", base: "Базовый ориентир", perMetre: "за м²",
    ranges: ["До 40 м²", "41–60 м²", "61–80 м²", "81–99 м²", "От 100 м²"],
    priceNote: "Ориентиры для уборки без дополнений. Укажите площадь и нужные работы в калькуляторе; состояние помещения уточним до подтверждения цены. Срочный выезд в день обращения — при наличии времени, с доплатой 20%.",
    example: "Как складывается цена", exampleNote: "Пример по действующим тарифам, без срочного выезда. Точную стоимость согласуем после описания или фото помещения.",
    exampleBase: "Уборка", total: "В этом примере", prepare: "Что указать в заявке", next: "Что дальше",
    nextText: "Менеджер уточнит детали, при необходимости попросит фото и согласует стоимость и доступное время. Оплата — после проверки результата.",
  },
  sr: {
    navigation: "Na ovoj stranici", prices: "Cena prema kvadraturi", area: "Površina", base: "Osnovna procena", perMetre: "po m²",
    ranges: ["Do 40 m²", "41–60 m²", "61–80 m²", "81–99 m²", "Od 100 m²"],
    priceNote: "Okvirne cene bez dodatnih radova. Unesite kvadraturu i izaberite dodatke u kalkulatoru; stanje prostora proveravamo pre potvrde cene. Dolazak istog dana moguć je ako ima slobodnih termina, uz doplatu od 20%.",
    example: "Kako se formira cena", exampleNote: "Primer prema važećem cenovniku, bez hitnog dolaska. Konačnu cenu dogovaramo na osnovu opisa ili fotografija prostora.",
    exampleBase: "Čišćenje", total: "Ukupno u ovom primeru", prepare: "Šta navesti u upitu", next: "Šta sledi",
    nextText: "Menadžer će proveriti detalje, po potrebi zatražiti fotografije i dogovoriti cenu i slobodan termin. Plaćanje je nakon provere rezultata.",
  },
  en: {
    navigation: "On this page", prices: "Prices by floor area", area: "Floor area", base: "Base estimate", perMetre: "per m²",
    ranges: ["Up to 40 m²", "41–60 m²", "61–80 m²", "81–99 m²", "100 m² and up"],
    priceNote: "Estimates exclude extras. Enter your floor area and tasks in the calculator; we check the condition before confirming the price. Same-day cleaning is subject to availability and carries a 20% surcharge.",
    example: "How the price adds up", exampleNote: "An example using current rates, without same-day service. We agree the final price after reviewing your description or photos of the space.",
    exampleBase: "Cleaning", total: "Total in this example", prepare: "What to include in your enquiry", next: "What happens next",
    nextText: "Our manager will check the details, ask for photos if needed, and agree the price and an available time. Payment is after you check the result.",
  },
};

export const serviceBriefs: Record<Locale, Record<ServiceId, Brief>> = {
  ru: {
    regular: {
      title: "Для разовой или регулярной уборки",
      items: [
        "Площадь, район и желаемая дата. Если нужен постоянный график — как часто вы хотели бы заказывать уборку.",
        "Каким зонам уделить внимание: например, кухне, ванной или следам шерсти. Застарелые загрязнения лучше описать отдельно.",
        "Нужны ли окна, балкон или мойка техники внутри. Эти работы не входят в базовую стоимость.",
      ],
      note: "Перед визитом уберите мелкие личные вещи с поверхностей, которые нужно протереть. Мыть квартиру заранее не нужно.",
    },
    deep: {
      title: "Чтобы оценить объём генеральной уборки",
      items: [
        "Площадь и состояние кухни и санузла. Фото налёта или жира помогают понять, сколько работы предстоит.",
        "Поверхности, с которыми нужно обращаться особенно бережно: камень, дерево, окрашенные фасады. Укажите известные повреждения.",
        "Какие внутренние зоны добавить: духовку, холодильник, шкафы. Окна и балкон также считаются отдельно.",
      ],
      note: "Генеральная уборка рассчитана на бытовые загрязнения. Строительную пыль, краску и клей после ремонта мы не убираем.",
    },
    move: {
      title: "Перед въездом или передачей ключей",
      items: [
        "Когда вывезут вещи и когда нужно передать квартиру. Укажите, останутся ли мебель и коробки.",
        "Площадь и список техники и шкафов, которые нужно вымыть внутри. Освободите выбранные зоны от вещей и продуктов к визиту.",
        "Нужны ли окна и балкон, есть ли бытовые загрязнения, требующие внимания. Последствия ремонта в эту услугу не входят.",
      ],
      note: "Лучше назначить уборку между вывозом старых вещей и доставкой новых. Если квартира остаётся обставленной, сообщите об этом при расчёте.",
    },
    airbnb: {
      title: "Чтобы согласовать уборку между гостями",
      items: [
        "Площадь апартамента, время выезда гостей и следующего заезда. Слот подтверждаем до принятия заказа.",
        "Нужна ли смена белья и где будет лежать чистый комплект. Смена подготовленного белья — отдельная позиция расчёта.",
        "Задачи помимо обычной уборки: техника внутри, окна, балкон. Стирка и доставка расходников в базовую услугу не входят.",
      ],
      note: "Перед первым визитом составьте короткий список обязательных зон. Его можно использовать для следующих уборок, уточняя изменения заранее.",
    },
    office: {
      title: "Для небольшого офиса или студии",
      items: [
        "Площадь, число рабочих мест и санузлов, наличие кухонного уголка. Нужна разовая уборка или повторяющийся график.",
        "Желаемое время и доступные зоны. Отметьте столы, где остаются документы, и технику, которую нельзя трогать.",
        "Нужны ли окна, внутренние поверхности шкафов или холодильника. Такие задачи согласуются отдельно.",
      ],
      note: "Освободите поверхности, которые нужно протереть. Документы и личные вещи сотрудников не перемещаем без договорённости. Промышленный клининг не выполняем.",
    },
  },
  sr: {
    regular: {
      title: "Za jednokratno ili redovno čišćenje",
      items: [
        "Kvadratura, deo grada i željeni datum. Za redovno čišćenje navedite koliko često vam je potrebno.",
        "Zone kojima treba posvetiti pažnju: kuhinja, kupatilo ili dlake kućnih ljubimaca. Posebno opišite staru, tvrdokornu prljavštinu.",
        "Da li su potrebni pranje prozora, čišćenje balkona ili unutrašnjosti uređaja. Ti radovi nisu uključeni u osnovnu cenu.",
      ],
      note: "Pre dolaska sklonite sitne lične stvari sa površina koje treba obrisati. Ne morate prethodno da čistite stan.",
    },
    deep: {
      title: "Za procenu obima generalnog čišćenja",
      items: [
        "Kvadratura i stanje kuhinje i kupatila. Fotografije naslaga ili masnoće pomažu da procenimo obim posla.",
        "Površine koje traže posebnu pažnju: kamen, drvo ili farbani frontovi. Navedite postojeća oštećenja.",
        "Koje unutrašnje površine treba dodati: rernu, frižider ili ormariće. Prozori i balkon se takođe obračunavaju posebno.",
      ],
      note: "Generalno čišćenje je namenjeno prljavštini nastaloj tokom stanovanja. Ne uklanjamo građevinsku prašinu, boju i lepak nakon renoviranja.",
    },
    move: {
      title: "Pre useljenja ili predaje ključeva",
      items: [
        "Kada se stvari iznose i kada stan treba predati. Navedite da li ostaju nameštaj i kutije.",
        "Kvadratura i spisak uređaja i ormarića koje treba očistiti iznutra. Pre dolaska iz njih izvadite stvari i namirnice.",
        "Da li su potrebni prozori i balkon i ima li zaprljanja koja traže više pažnje. Čišćenje posle renoviranja nije obuhvaćeno.",
      ],
      note: "Najpraktičnije je zakazati čišćenje između iznošenja starih i unošenja novih stvari. Ako stan ostaje namešten, navedite to pri traženju procene.",
    },
    airbnb: {
      title: "Za dogovor o čišćenju između gostiju",
      items: [
        "Kvadratura apartmana, vreme odlaska gostiju i sledećeg dolaska. Termin potvrđujemo pre prihvatanja posla.",
        "Da li treba promeniti posteljinu i gde će biti pripremljen čist komplet. Promena pripremljene posteljine naplaćuje se posebno.",
        "Zadaci van osnovnog čišćenja: unutrašnjost uređaja, prozori, balkon. Pranje veša i dostava potrošnog materijala nisu u osnovnoj ceni.",
      ],
      note: "Pre prve posete napravite kratak spisak obaveznih zona. Može služiti i za naredna čišćenja, uz unapred dogovorene izmene.",
    },
    office: {
      title: "Za manju kancelariju ili studio",
      items: [
        "Kvadratura, broj radnih mesta i toaleta i da li postoji čajna kuhinja. Navedite da li želite jednokratno ili redovno čišćenje.",
        "Željeno vreme i zone kojima možemo pristupiti. Označite stolove sa dokumentima i opremu koju ne treba dirati.",
        "Da li treba oprati prozore ili očistiti ormariće i frižider iznutra. Ti zadaci se posebno dogovaraju.",
      ],
      note: "Oslobodite površine koje treba obrisati. Dokumenta i lične stvari zaposlenih ne pomeramo bez dogovora. Ne radimo industrijsko čišćenje.",
    },
  },
  en: {
    regular: {
      title: "For a one-off or regular clean",
      items: [
        "Floor area, district and preferred date. For recurring cleaning, tell us how often you would like a visit.",
        "Areas that need attention, such as the kitchen, bathroom or pet hair. Describe any old or stubborn dirt separately.",
        "Whether you need windows, a balcony or appliance interiors cleaned. These tasks are outside the base price.",
      ],
      note: "Before we arrive, clear small personal items from surfaces that need wiping. You do not need to clean the apartment first.",
    },
    deep: {
      title: "To estimate the scope of a deep clean",
      items: [
        "Floor area and the condition of the kitchen and bathroom. Photos of deposits or grease help us assess the work.",
        "Surfaces needing particular care, such as stone, wood or painted fronts. Mention any existing damage.",
        "Which interiors to add: oven, fridge or cabinets. Windows and the balcony are also priced separately.",
      ],
      note: "Deep cleaning covers dirt from everyday living. We do not remove construction dust, paint or glue after renovation.",
    },
    move: {
      title: "Before moving in or handing back the keys",
      items: [
        "When belongings will be removed and when the apartment must be handed over. Tell us if furniture or boxes will remain.",
        "Floor area and the appliances and cabinets to clean inside. Empty these of belongings and food before the visit.",
        "Whether windows and a balcony need cleaning, and any household dirt needing extra attention. Post-renovation cleaning is not included.",
      ],
      note: "It is easiest to arrange cleaning between removing old belongings and bringing new ones in. If the apartment will remain furnished, mention this when requesting an estimate.",
    },
    airbnb: {
      title: "To arrange cleaning between guests",
      items: [
        "Apartment floor area, guest checkout and the next check-in time. We confirm availability before accepting the booking.",
        "Whether linen needs changing and where the clean set will be ready. Changing prepared linen is charged separately.",
        "Tasks beyond the standard clean: appliance interiors, windows or the balcony. Laundry and supply delivery are not part of the base service.",
      ],
      note: "Before the first visit, make a short checklist of essential areas. Use it for later cleans and agree any changes in advance.",
    },
    office: {
      title: "For a small office or studio",
      items: [
        "Floor area, number of desks and bathrooms, and whether there is a kitchenette. Tell us if you need a one-off visit or regular cleaning.",
        "Preferred time and accessible areas. Point out desks with documents and equipment that should not be touched.",
        "Whether windows, cabinet interiors or a fridge need cleaning. These tasks are agreed separately.",
      ],
      note: "Clear the surfaces that need wiping. We do not move documents or staff belongings without agreement. We do not provide industrial cleaning.",
    },
  },
};
