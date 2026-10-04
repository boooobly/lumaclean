import type {Article} from "./types";

export const petHair: Article = {
  id: "pet-hair",
  services: [
    "regular",
    "deep"
  ],
  relatedIds: [
    "frequency",
    "prepare",
    "regular-deep"
  ],
  translations: {
    ru: {
      slug: "uborka-kvartiry-ot-shersti",
      title: "Шерсть в квартире: что помогает между уборками и что сказать клинерам",
      description: "Как уменьшить скопления шерсти на полу и мебели и подготовить квартиру к уборке с питомцем. Что уточнить о текстиле и дополнительной опции LumaClean.",
      category: "Дом с питомцем",
      imageAlt: "Иллюстрация рыжего кота рядом со светлым диваном и бирюзовым пледом",
      lead: "Пол только что убрали, а у ножек дивана уже собралась шерсть. С животными это знакомая история. Не обязательно каждый раз убирать всю квартиру: сначала найдите места, где шерсть скапливается, и договоритесь, какие из них входят в следующий визит.",
      sections: [
        {
          id: "spots",
          title: "Начните с привычных мест питомца",
          paragraphs: [
            "Посмотрите вокруг лежанки, под доступным краем дивана, возле мисок и вдоль плинтусов. Шерсть часто заметнее именно там, а не посреди комнаты. Короткий проход по этим местам между основными уборками может быть полезнее, чем редкая попытка привести всё в порядок сразу.",
            "Не передвигайте тяжёлую мебель ради каждого комка. Для следующего заказа лучше указать, куда можно добраться свободно, а где доступ закрыт. Уборка доступного пола и работа под тяжёлым шкафом — разные условия."
          ]
        },
        {
          id: "between",
          title: "Ухаживайте за полом и съёмным текстилем",
          paragraphs: [
            "Для пола используйте подходящую насадку пылесоса и режим, разрешённый для покрытия. Проверяйте контейнер и фильтр по инструкции прибора. Если пылесос стал хуже собирать шерсть, не всегда помогает просто дольше водить им по одному месту.",
            "На диване или кресле удобен съёмный плед, если питомец любит одно место. Ухаживайте за ним по ярлыку ткани. Ролик для одежды может помочь на небольшом участке, но перед использованием проверьте, подходит ли он материалу. Не переносите способ ухода за прочным пледом на деликатную обивку."
          ]
        },
        {
          id: "booking",
          title: "Опишите количество шерсти и поверхности",
          paragraphs: [
            "У LumaClean в калькуляторе есть дополнение для большого количества шерсти. Сообщите о питомце и пришлите фотографии пола и проблемных мест. Наличие кошки или собаки само по себе не означает, что опция обязательно нужна; важен фактический объём работы.",
            "Отдельно уточните, что можно сделать с текстилем. Обычная уборка квартиры не равна химчистке дивана, матраса или ковра. Не заказывайте её в расчёте на удаление запахов и любых пятен с обивки."
          ],
          bullets: [
            "Где шерсти больше всего: пол, ковёр, диван или лежанка?",
            "Можно ли свободно подойти к этим местам?",
            "Есть ли деликатные материалы?",
            "Где будет питомец во время визита?"
          ]
        },
        {
          id: "visit",
          title: "Подготовьте спокойное место для животного",
          paragraphs: [
            "До приезда решите, где питомец будет находиться, пока открываются двери и работает техника. Предупредите команду, если животное боится пылесоса или стремится выйти в подъезд. Миски, игрушки и лежанку убирайте только так, как удобно вам и питомцу.",
            "Уборка помогает убрать видимую шерсть и согласованные загрязнения. Она не делает квартиру свободной от аллергенов и не заменяет уход за животным. Для регулярного графика ориентируйтесь на состояние дома между визитами, а не на обещание, что шерсть больше не появится."
          ],
          tip: "Передайте команде одну понятную просьбу о питомце: например, не открывать дверь в комнату, где он остаётся."
        }
      ]
    },
    sr: {
      slug: "dlake-kucnih-ljubimaca-u-stanu",
      title: "Dlake kućnih ljubimaca u stanu: održavanje između čišćenja",
      description: "Gde se skupljaju dlake, kako održavati dostupne površine i šta reći timu pre dolaska. Tekstil, pristup i dodatak za mnogo dlaka ljubimaca.",
      category: "Dom sa ljubimcem",
      imageAlt: "Ilustracija riđe mačke pored svetle sofe i tirkiznog prekrivača",
      lead: "Pod je tek očišćen, a oko nogara sofe već ima dlaka. Sa ljubimcem je to poznata pojava. Umesto da svaki put čistite sve, pronađite mesta gde se dlake skupljaju i dogovorite šta ulazi u sledeći dolazak.",
      sections: [
        {
          id: "spots",
          title: "Krenite od mesta gde ljubimac boravi",
          paragraphs: [
            "Pogledajte oko ležaja, ispod dostupne ivice sofe, pored činija i uz lajsne. Kratko održavanje tih mesta između većih čišćenja može biti praktičnije od povremenog pokušaja da se sve uradi odjednom.",
            "Ne pomerajte težak nameštaj zbog svake grudvice. Za sledeći dolazak navedite gde je pristup slobodan, a gde zatvoren. Dostupan pod i prostor ispod teškog ormara nisu isti uslovi rada."
          ]
        },
        {
          id: "between",
          title: "Održavajte pod i tekstil prema uputstvu",
          paragraphs: [
            "Koristite nastavak usisivača i režim koji odgovaraju podu. Posudu i filter proveravajte prema uputstvu uređaja. Ako slabije skuplja dlake, duži prelazak preko istog mesta ne rešava nužno problem.",
            "Ako ljubimac bira isto mesto na sofi, prekrivač koji se skida može olakšati održavanje. Pratite oznaku za negu tkanine. Valjak može pomoći na maloj površini ako odgovara materijalu; postupak za otporan prekrivač ne prenosite automatski na osetljiv tapacirung."
          ]
        },
        {
          id: "booking",
          title: "Opišite količinu i površine",
          paragraphs: [
            "LumaClean kalkulator ima dodatak za mnogo dlaka ljubimaca. Pomenite životinju i pošaljite slike poda i zahtevnih mesta. Samo prisustvo mačke ili psa ne znači da je dodatak obavezan; važan je stvarni posao.",
            "Posebno pitajte za tekstil. Čišćenje stana nije dubinsko pranje sofe, dušeka ili tepiha i ne treba ga zakazati uz očekivanje uklanjanja svih mirisa i fleka."
          ],
          bullets: [
            "Gde ima najviše dlaka?",
            "Da li je pristup slobodan?",
            "Postoje li osetljive tkanine?",
            "Gde će ljubimac biti tokom dolaska?"
          ]
        },
        {
          id: "visit",
          title: "Pripremite mirno mesto za ljubimca",
          paragraphs: [
            "Odlučite gde će životinja boraviti dok se otvaraju vrata i koristi oprema. Javite ako se plaši usisivača ili pokušava da izađe. Činije, igračke i ležaj pomerite prema svojim potrebama.",
            "Čišćenje uklanja vidljive dlake i dogovorenu prljavštinu, ali ne čini stan prostorom bez alergena. Raspored birajte prema stvarnom stanju između dolazaka, bez očekivanja da se dlake više neće pojaviti."
          ],
          tip: "Dajte jedno jasno uputstvo, na primer da vrata sobe u kojoj je ljubimac ostanu zatvorena."
        }
      ]
    },
    en: {
      slug: "pet-hair-apartment-cleaning",
      title: "Pet hair at home: upkeep between cleans and what to tell the team",
      description: "Find pet-hair gathering spots, maintain accessible floors and textiles, and prepare for cleaning with a pet at home. Clarify the scope before booking.",
      category: "Living with pets",
      imageAlt: "Illustration of an orange cat beside a cream sofa and teal throw",
      lead: "The floor has just been cleaned, yet hair is gathering around the sofa legs again. With a pet, this is familiar. Start by identifying those gathering spots rather than cleaning the whole apartment every time.",
      sections: [
        {
          id: "spots",
          title: "Start where your pet spends time",
          paragraphs: [
            "Check around the bed, beneath accessible sofa edges, near bowls and along skirting boards. Brief attention to these areas between full cleans may be more practical than occasionally trying to tackle everything at once.",
            "Do not move heavy furniture for every clump. Tell the team which areas are accessible and which are blocked. An open floor and a space beneath a heavy cupboard are different working conditions."
          ]
        },
        {
          id: "between",
          title: "Follow floor and fabric care instructions",
          paragraphs: [
            "Use a vacuum attachment and setting suitable for the floor. Check the container and filter according to the appliance instructions. If pickup has weakened, repeatedly passing over the same spot may not solve it.",
            "A removable throw can help if your pet favours one seat. Follow its care label. A lint roller may help on a small area if suitable for the fabric; a method that works on a sturdy throw should not automatically be used on delicate upholstery."
          ]
        },
        {
          id: "booking",
          title: "Describe the amount and location",
          paragraphs: [
            "LumaClean's calculator includes a heavy-pet-hair extra. Mention the pet and send photographs of the floors and difficult areas. Having a cat or dog does not automatically mean the extra is needed; the actual workload matters.",
            "Ask separately about textiles. Apartment cleaning is not upholstery, mattress or carpet deep washing. Do not book it expecting all fabric stains or odours to be removed."
          ],
          bullets: [
            "Where does most hair collect?",
            "Can those areas be reached easily?",
            "Are any fabrics delicate?",
            "Where will the pet stay during the visit?"
          ]
        },
        {
          id: "visit",
          title: "Arrange a quiet place for your pet",
          paragraphs: [
            "Decide where your pet will stay while doors are opened and equipment is used. Mention fear of vacuums or a tendency to run into the hallway. Move bowls, toys and bedding in a way that suits your household.",
            "Cleaning removes visible hair and agreed dirt; it does not create an allergen-free home. Choose a schedule by the condition between visits rather than expecting pet hair to stop appearing."
          ],
          tip: "Give one clear instruction, such as keeping the door to the pet's room closed."
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/pet-hair.webp"
};
