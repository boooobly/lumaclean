import type {Article} from "./types";

export const sameDay: Article = {
  id: "same-day",
  status: "draft",
  updatedAt: "2026-10-04",
  image: "/media/articles/same-day.webp",
  services: ["regular", "deep"],
  relatedIds: ["prepare", "duration", "regular-deep"],
  translations: {
    ru: {
      slug: "uborka-kvartiry-segodnya-v-belgrade",
      title: "Уборка квартиры сегодня в Белграде: что указать в заявке",
      description: "Как запросить уборку квартиры в Белграде в день обращения: какие данные и фотографии нужны для проверки свободного времени и расчёта цены.",
      category: "Срочная уборка",
      imageAlt: "Концептуальная иллюстрация телефона, часов и сложенной салфетки в светлой квартире",
      lead: "Уборка в день обращения возможна, только если у команды осталось свободное время. Чёткая заявка помогает быстрее проверить график, объём работы и стоимость — без обещания, что любой адрес можно принять немедленно.",
      sections: [
        {
          id: "availability",
          title: "Сначала проверьте свободное время и доплату",
          paragraphs: [
            "LumaClean принимает обращения ежедневно с 09:00 до 22:00 по времени Белграда. Запрос и подтверждение записи на сегодня должны быть до 17:00 по Белграду; каждый клинер должен выехать до 17:00. После 17:00 выбираем дату начиная с завтра. Срочный выезд возможен только после проверки свободной команды и маршрута и увеличивает рассчитанную стоимость на 20%. Это не отдельный пакет и не гарантия приезда: менеджер сначала проверяет график и детали квартиры.",
            "В сообщении укажите желаемое время и напишите, подходит ли вам ближайший другой вариант, если сегодня свободного окна нет. Так ответ будет содержать не только «да» или «нет», но и понятное ограничение по времени.",
          ],
          tip: "Не отправляйте несколько одинаковых заявок подряд. Одного сообщения с площадью, районом, задачами и удобным временем достаточно для первой проверки.",
        },
        {
          id: "request",
          title: "Что написать в первом сообщении",
          paragraphs: [
            "Для предварительной оценки нужны площадь квартиры, часть Белграда, состояние помещений и основной результат. Напишите, требуется ли поддерживающая или генеральная уборка, либо опишите ситуацию своими словами. Если вы не уверены в формате, перечислите зоны, которым нужно уделить больше внимания.",
            "Отдельно укажите окна, балкон, духовку, холодильник и шкафы внутри, смену постельного белья или большое количество шерсти. Эти работы не следует считать автоматически включёнными в базовую уборку. Для доступа полезно заранее сообщить этаж, наличие лифта и особенности входа, но не публикуйте адрес в открытых комментариях.",
          ],
          bullets: [
            "Площадь квартиры и часть Белграда.",
            "Желаемое время и допустимый запас по времени.",
            "Поддерживающая, генеральная уборка или краткое описание состояния.",
            "Приоритетные комнаты и все дополнительные работы.",
            "Кто откроет квартиру и есть ли особенности доступа.",
          ],
        },
        {
          id: "photos",
          title: "Какие фотографии действительно помогают",
          paragraphs: [
            "Сделайте по одному общему кадру кухни и ванной, затем добавьте крупные планы стойких загрязнений и дополнительных зон. Фотография всей комнаты показывает объём, а крупный план помогает отличить обычные следы от задачи, которой потребуется больше времени.",
            "Перед отправкой уберите из кадра документы, лица, номера ключей и другие личные данные. Не нужно фотографировать каждую полку, если её внутренняя уборка не входит в запрос. Для окон полезны общий вид и кадр, показывающий размер и доступ к створкам.",
          ],
        },
        {
          id: "confirmation",
          title: "Когда заявка считается согласованной",
          paragraphs: [
            "После получения описания менеджер проверяет детали, при необходимости задаёт вопросы и подтверждает цену и свободное время. Расчёт в калькуляторе остаётся ориентиром до такого подтверждения. Если состояние квартиры или список работ изменились, сообщите об этом до приезда команды.",
            "По телефону LumaClean общается на русском и английском. На сербском удобнее написать в Viber. После согласования подготовьте доступ к квартире, освободите нужные поверхности и оставайтесь на связи — подробный список есть в отдельном руководстве о подготовке к приезду клинеров.",
          ],
        },
      ],
    },
    sr: {
      slug: "ciscenje-stana-danas-beograd",
      title: "Čišćenje stana danas u Beogradu: šta navesti u upitu",
      description: "Kako poslati upit za čišćenje stana istog dana u Beogradu: podaci i fotografije potrebni za proveru termina i procenu cene.",
      category: "Hitno čišćenje",
      imageAlt: "Konceptualna ilustracija telefona, sata i složene krpe u svetlom stanu",
      lead: "Čišćenje istog dana moguće je samo ako tim ima slobodan termin. Jasan upit ubrzava proveru rasporeda, obima i cene, ali ne znači da je svaki termin odmah dostupan.",
      sections: [
        {
          id: "availability",
          title: "Prvo proverite termin i doplatu",
          paragraphs: [
            "LumaClean prima upite svakog dana od 09:00 do 22:00 po beogradskom vremenu. Upit i potvrda za danas moraju biti pre 17:00 po vremenu Beograda; svaki član tima mora krenuti pre 17:00. Posle 17:00 proveravamo termine od sutra. Dolazak je moguć samo nakon provere tima i rute i uvećava obračunatu cenu za 20%. To nije poseban paket niti garancija dolaska: menadžer prvo proverava raspored i detalje stana.",
            "U poruci navedite željeno vreme i napišite da li vam odgovara najbliži drugi termin ako danas nema slobodnog mesta. Tako odmah razdvajamo obavezno vreme od onoga što može da se prilagodi.",
          ],
          tip: "Ne šaljite više istih poruka. Za prvu proveru dovoljan je jedan upit sa kvadraturom, delom grada, zadacima i željenim vremenom.",
        },
        {
          id: "request",
          title: "Šta napisati u prvoj poruci",
          paragraphs: [
            "Za početnu procenu navedite kvadraturu, deo Beograda, stanje prostorija i glavni rezultat koji očekujete. Napišite da li tražite redovno ili generalno čišćenje, ili jednostavno opišite situaciju. Ako niste sigurni u format, izdvojite zone kojima treba više pažnje.",
            "Posebno navedite prozore, balkon, unutrašnjost rerne, frižidera ili ormarića, promenu posteljine i mnogo dlaka ljubimaca. Ti poslovi se ne podrazumevaju u osnovnom čišćenju. Za pristup je korisno pomenuti sprat, lift i posebna uputstva za ulaz, ali adresu nemojte ostavljati u javnim komentarima.",
          ],
          bullets: [
            "Kvadratura i deo Beograda.",
            "Željeno vreme i mogući raspon dolaska.",
            "Redovno, generalno čišćenje ili kratak opis stanja.",
            "Prioritetne prostorije i svi dodatni radovi.",
            "Ko otvara stan i da li postoje posebnosti pristupa.",
          ],
        },
        {
          id: "photos",
          title: "Koje fotografije zaista pomažu",
          paragraphs: [
            "Pošaljite po jednu širu fotografiju kuhinje i kupatila, a zatim krupne planove tvrdokornih tragova i dodatnih zona. Širi kadar pokazuje obim, dok detalj pomaže da se obični tragovi razlikuju od posla koji može zahtevati više vremena.",
            "Pre slanja sklonite iz kadra dokumenta, lica, oznake ključeva i druge lične podatke. Nema potrebe da fotografišete svaku policu ako unutrašnje čišćenje nije deo upita. Za prozore su korisni opšti kadar i fotografija koja pokazuje veličinu i pristup krilima.",
          ],
        },
        {
          id: "confirmation",
          title: "Kada je termin dogovoren",
          paragraphs: [
            "Nakon opisa menadžer proverava detalje, po potrebi postavlja pitanja i potvrđuje cenu i slobodan termin. Iznos iz kalkulatora ostaje okvir dok ne dobijete tu potvrdu. Ako se stanje stana ili spisak poslova promeni, javite pre dolaska tima.",
            "Telefonom razgovaramo na ruskom i engleskom, a na srpskom nam pišite preko Vibera. Posle dogovora obezbedite pristup, oslobodite potrebne površine i ostanite dostupni; detaljan spisak je u posebnom vodiču za pripremu pre dolaska tima.",
          ],
        },
      ],
    },
    en: {
      slug: "same-day-apartment-cleaning-belgrade",
      title: "Same-day apartment cleaning in Belgrade: what to include",
      description: "How to request same-day apartment cleaning in Belgrade: the details and photographs needed to check availability and estimate the price.",
      category: "Same-day cleaning",
      imageAlt: "Conceptual illustration of a phone, clock and folded cleaning cloth in a bright apartment",
      lead: "Same-day cleaning is possible only when the team has an open slot. A clear enquiry makes it quicker to check the schedule, scope and price, but it cannot make every time or address immediately available.",
      sections: [
        {
          id: "availability",
          title: "Check availability and the surcharge first",
          paragraphs: [
            "LumaClean accepts enquiries every day from 09:00 to 22:00 Belgrade time. Same-day requests and confirmation must be before 17:00 Belgrade time; each cleaner must depart before 17:00. After 17:00 we check dates from tomorrow. A visit is possible only after checking crew and route availability and adds 20% to the calculated price. It is not a separate package or a guaranteed arrival: the manager checks the schedule and apartment details first.",
            "State your preferred time and whether the nearest alternative would work if today is full. This separates a fixed deadline from the part of the request that can be adjusted.",
          ],
          tip: "Do not send several copies of the same request. One message with the floor area, part of the city, tasks and preferred time is enough for the first check.",
        },
        {
          id: "request",
          title: "What to include in the first message",
          paragraphs: [
            "For an initial estimate, include the apartment size, part of Belgrade, condition of the rooms and the main result you need. Say whether you are considering regular or deep cleaning, or describe the situation in your own words. If you are unsure, point out the areas that need extra attention.",
            "List windows, the balcony, the insides of the oven, fridge or cupboards, a linen change and a large amount of pet hair separately. These tasks should not be assumed to be part of the base clean. It also helps to mention the floor, lift and unusual access instructions, but do not post the full address in a public comment.",
          ],
          bullets: [
            "Apartment size and part of Belgrade.",
            "Preferred time and any acceptable arrival window.",
            "Regular cleaning, deep cleaning or a short description of the condition.",
            "Priority rooms and every additional task.",
            "Who will provide access and whether there are entry restrictions.",
          ],
        },
        {
          id: "photos",
          title: "Photographs that help with the estimate",
          paragraphs: [
            "Send one wide view of the kitchen and bathroom, followed by close-ups of stubborn marks and optional areas. A wide photograph shows the scale, while a detail helps distinguish everyday marks from work that may need more time.",
            "Remove documents, faces, key labels and other personal information from the frame. There is no need to photograph every shelf unless internal cupboard cleaning is part of the request. For windows, include an overall view and an image that shows their size and access to the panels.",
          ],
        },
        {
          id: "confirmation",
          title: "When the booking is agreed",
          paragraphs: [
            "After receiving the description, the manager checks the details, asks any necessary questions and confirms the price and available time. The calculator remains an estimate until that confirmation. If the apartment condition or task list changes, explain this before the team arrives.",
            "LumaClean speaks Russian and English by phone. For Serbian, write through Viber. Once the visit is agreed, arrange access, clear the relevant surfaces and stay reachable; the separate preparation guide has a fuller pre-arrival checklist.",
          ],
        },
      ],
    },
  },
};
