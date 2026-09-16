import type {Article} from "./types";

export const frequency: Article = {
  id: "frequency",
  services: [
    "regular"
  ],
  relatedIds: [
    "regular-deep",
    "pet-hair",
    "kitchen"
  ],
  translations: {
    ru: {
      slug: "kak-chasto-zakazyvat-uborku",
      title: "Раз в неделю или раз в две: как выбрать график уборки квартиры",
      description: "Как подобрать частоту уборки квартиры под привычки семьи: кухня, санузел, животные и уход между визитами. Когда стоит изменить график.",
      category: "Повседневный уход",
      imageAlt: "Иллюстрация светлого жилого уголка с бирюзовым пледом и солнечной тенью",
      lead: "Одинаковая площадь не означает одинаковый график уборки. В одной квартире почти не готовят и редко бывают дома, в другой ежедневно собирается семья с собакой. Начните с того, где порядок перестаёт вас устраивать раньше всего.",
      sections: [
        {
          id: "observe",
          title: "Посмотрите, что происходит между уборками",
          paragraphs: [
            "Вспомните последнюю неделю. Когда снова понадобилось мыть пол, протирать раковину или убирать кухню? Не ориентируйтесь только на пыль на полке: у разных зон свой темп загрязнения.",
            "Полезно несколько дней отмечать именно неудобства. Например, к выходным не хочется заходить босиком в прихожую, а кухонные фасады остаются чистыми. Такой список покажет, нужен ли более частый общий визит или небольшой уход за одной зоной."
          ]
        },
        {
          id: "weekly",
          title: "Когда удобнее еженедельный визит",
          paragraphs: [
            "Еженедельный формат стоит рассмотреть, если вы много готовите, постоянно пользуетесь всеми комнатами или не хотите выделять выходные на полы и санузел. Это не обязанность для семьи определённого размера, а способ распределить нагрузку.",
            "При наличии животных смотрите на фактическое количество шерсти. Один питомец может требовать частого прохода по полу, но само его присутствие ещё не определяет формат всей квартиры."
          ],
          bullets: [
            "Какая зона становится неудобной первой?",
            "Что вы готовы делать сами между визитами?",
            "Успевает ли загрязнение накопиться до стойких следов?"
          ]
        },
        {
          id: "fortnightly",
          title: "Когда можно начать с двух недель",
          paragraphs: [
            "Если квартира используется спокойно и вы поддерживаете кухню, пол и санузел между визитами, интервал в две недели может оказаться удобным. Но клинеры не должны каждый раз начинать с объёма, который уже требует генерального формата.",
            "Сначала оцените текущее состояние. Если накопилось много загрязнений, обсудите более тщательную первую уборку, а затем поддерживающий график. Периодичность не превращает сложную уборку в обычную автоматически."
          ],
          tip: "Не выбирайте интервал только ради меньшего числа заказов. Учтите собственное время на уборку между ними."
        },
        {
          id: "adjust",
          title: "Пересмотрите график после нескольких визитов",
          paragraphs: [
            "Отметьте, что оказалось лишним, а чего не хватило. Возможно, полам нужен короткий интервал, а окна достаточно заказывать отдельно по состоянию. Не включайте духовку и внутренние шкафы в каждый визит просто по привычке.",
            "У LumaClean можно обсудить поддерживающие уборки и нужные дополнения. Частоту и доступные дни согласуют при обращении; она не означает автоматически скидку или абонемент. После поездки, праздника или переезда график можно пересмотреть под новые задачи."
          ]
        }
      ]
    },
    sr: {
      slug: "koliko-cesto-zakazivati-ciscenje",
      title: "Čišćenje jednom nedeljno ili na dve nedelje: kako izabrati ritam",
      description: "Prilagodite učestalost čišćenja navikama u stanu: kuvanje, kupatilo, ljubimci i održavanje između dolazaka. Kada promeniti raspored.",
      category: "Održavanje doma",
      imageAlt: "Ilustracija svetlog kutka sa tirkiznim prekrivačem i sunčevom senkom",
      lead: "Ista kvadratura ne znači isti raspored. U jednom stanu se retko kuva, a u drugom svakodnevno boravi porodica sa psom. Počnite od mesta na kojem vam stanje najbrže počne da smeta.",
      sections: [
        {
          id: "observe",
          title: "Pratite šta se dešava između dolazaka",
          paragraphs: [
            "Kada ste ponovo morali da obrišete pod, lavabo ili kuhinju? Prašina na polici nije jedino merilo; različite zone prljaju se različitim tempom.",
            "Nekoliko dana beležite konkretne smetnje. Možda hodnik već traži pažnju, dok su kuhinjski frontovi i dalje uredni. To pomaže da odlučite da li treba češće čistiti ceo stan ili kratko održavati jednu zonu."
          ]
        },
        {
          id: "weekly",
          title: "Kada razmotriti nedeljni dolazak",
          paragraphs: [
            "Nedeljni ritam može odgovarati ako često kuvate, stalno koristite sve sobe ili ne želite da vikend provedete uz podove i kupatilo. To nije pravilo vezano za broj ukućana, već način raspodele posla.",
            "Kod ljubimaca gledajte stvarnu količinu dlaka. Njihovo prisustvo samo po sebi ne određuje format za ceo stan."
          ],
          bullets: [
            "Koja zona prva traži pažnju?",
            "Šta želite sami da održavate?",
            "Da li se prljavština pretvara u uporne naslage?"
          ]
        },
        {
          id: "fortnightly",
          title: "Kada probati razmak od dve nedelje",
          paragraphs: [
            "Ako se stan manje opterećuje, a kuhinju, pod i kupatilo održavate usput, dve nedelje mogu biti dobar početak. Ipak, svaki dolazak ne bi trebalo da iznova zahteva generalno čišćenje.",
            "Ako se prljavština već nakupila, prvo dogovorite temeljniji posao, pa zatim redovno održavanje. Sama učestalost ne pretvara zahtevno čišćenje u rutinsko."
          ],
          tip: "Uračunajte i svoje vreme između dolazaka, ne samo broj porudžbina."
        },
        {
          id: "adjust",
          title: "Proverite raspored posle nekoliko poseta",
          paragraphs: [
            "Zabeležite šta je bilo potrebno, a šta može ređe. Podovi možda traže češću pažnju, dok prozore možete dodavati prema stanju. Unutrašnjost rerne i ormara ne mora automatski biti na svakom spisku.",
            "Sa LumaClean-om dogovarate održavanje i potrebne dodatke. Učestalost i termini potvrđuju se u razgovoru; redovan raspored ne znači automatski pretplatu ili popust. Posle putovanja ili proslave plan prilagodite novim potrebama."
          ]
        }
      ]
    },
    en: {
      slug: "how-often-to-book-cleaning",
      title: "Weekly or fortnightly cleaning: finding a rhythm for your apartment",
      description: "Choose a cleaning schedule around cooking, bathrooms, pets and the work you do between visits. How to tell when the interval needs adjusting.",
      category: "Everyday care",
      imageAlt: "Illustration of a bright living corner with a teal throw and a sunlit shadow",
      lead: "Two apartments of the same size may need different schedules. One is rarely used for cooking; another is home to a busy family and a dog. Start with the area that becomes uncomfortable first.",
      sections: [
        {
          id: "observe",
          title: "Notice what happens between visits",
          paragraphs: [
            "When did you need to clean the floor, sink or kitchen again? Dust on a shelf is only one clue. Different areas accumulate dirt at different rates.",
            "For a few days, note specific annoyances. The hallway may need attention while kitchen fronts still look fine. This helps distinguish a need for more frequent whole-home cleaning from a little upkeep in one zone."
          ]
        },
        {
          id: "weekly",
          title: "When a weekly visit may help",
          paragraphs: [
            "Consider weekly cleaning if you cook often, use every room heavily or prefer not to spend weekends on floors and bathrooms. It is a practical division of work, not a rule tied to household size.",
            "With pets, look at the actual amount of hair. Having an animal does not by itself determine the service needed throughout the apartment."
          ],
          bullets: [
            "Which area needs attention first?",
            "What will you maintain yourself?",
            "Does dirt build up into persistent marks?"
          ]
        },
        {
          id: "fortnightly",
          title: "When to try a two-week interval",
          paragraphs: [
            "If the apartment gets lighter use and you maintain the kitchen, floors and bathroom between visits, two weeks may be a useful starting point. Each appointment should not repeatedly turn into a deep clean.",
            "Assess the current condition first. If dirt has accumulated, discuss a more thorough initial visit before settling into regular cleaning. Frequency alone does not make demanding work routine."
          ],
          tip: "Count your own cleaning time between appointments as well as the number of bookings."
        },
        {
          id: "adjust",
          title: "Review after a few appointments",
          paragraphs: [
            "Note what needed attention and what could wait longer. Floors may benefit from a shorter interval while windows can be booked according to condition. Oven and cupboard interiors need not appear on every list by default.",
            "LumaClean can discuss regular visits and extras. Frequency and available dates are agreed when booking; a recurring schedule does not automatically mean a subscription or discount. Revisit the plan after travel, a party or a change in how you use the home."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/frequency.webp"
};
