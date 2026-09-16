import type {Article} from "./types";

export const duration: Article = {
  id: "duration",
  services: [
    "regular",
    "deep"
  ],
  relatedIds: [
    "prepare",
    "cost",
    "airbnb"
  ],
  translations: {
    ru: {
      slug: "skolko-vremeni-zanimaet-uborka",
      title: "Сколько времени занимает уборка квартиры и что её задерживает",
      description: "Почему время уборки зависит не только от площади. Как согласовать продолжительность визита в Белграде с учётом состояния, дополнений и доступа.",
      category: "Планирование",
      imageAlt: "Иллюстрация песочных часов на деревянной консоли в солнечной квартире",
      lead: "Хочется заказать уборку между двумя встречами и точно знать, когда можно закрыть дверь. Но площадь квартиры даёт лишь часть ответа. Время зависит от того, что нужно сделать, насколько свободен доступ и в каком состоянии кухня и санузел.",
      sections: [
        {
          id: "area",
          title: "Почему одной площади недостаточно",
          paragraphs: [
            "В пустой комнате и комнате со множеством мелких вещей одинаковые квадратные метры. Но во втором случае доступных участков меньше, а вокруг предметов приходится работать осторожнее. Несколько санузлов и активно используемая кухня тоже меняют объём.",
            "Срок со знакомым «у меня убрали за пару часов» не стоит переносить на свой заказ. Вы можете сравнивать разные форматы, составы команд и дополнения. Калькулятор LumaClean считает ориентировочную стоимость, а не обещанную длительность."
          ]
        },
        {
          id: "extras",
          title: "Учитывайте дополнительные работы",
          paragraphs: [
            "Окна, внутренняя часть духовки, холодильник и шкафы добавляют отдельные задачи. Если включить их уже после начала уборки, изначальный план времени может перестать подходить. Важны и состояние, и количество выбранных зон.",
            "Сразу обозначьте, что обязательно закончить сегодня. Если времени мало, обсудите перенос необязательных дополнений. Не просите просто «ускориться», сохранив прежний объём: сначала нужно понять, можно ли выполнить его в доступный промежуток."
          ]
        },
        {
          id: "delays",
          title: "Уберите причины задержек до визита",
          paragraphs: [
            "Часть времени теряется ещё до первого движения шваброй: поиск входа, ожидание ключа, недоступный шкаф или холодильник с продуктами. Проверьте, что команда сможет начать согласованные работы по приезде."
          ],
          bullets: [
            "Сообщите точный вход, этаж и способ доступа.",
            "Освободите поверхности, которые будут мыть.",
            "Подготовьте остывшую духовку и пустые согласованные шкафы.",
            "Предупредите о других работах или людях в квартире.",
            "Оставьте контакт для быстрых уточнений."
          ],
          tip: "Если перед уборкой приезжают грузчики или мастер, не назначайте их завершение и начало клининга на одно время."
        },
        {
          id: "window",
          title: "Как согласовать время, на которое можно опереться",
          paragraphs: [
            "При обращении отправьте площадь, фотографии, основной формат и дополнения. Назовите не только удобное начало, но и жёсткое ограничение: например, к определённому часу вам нужно уйти. Попросите подтвердить, подходит ли доступное окно для этого объёма.",
            "Если состояние квартиры изменилось после расчёта, сообщите об этом. Визит удобнее перепланировать заранее, чем обнаружить нехватку времени на месте. На сайте нет универсального срока для всех квартир, поэтому точную продолжительность следует согласовать для конкретного заказа."
          ]
        }
      ]
    },
    sr: {
      slug: "koliko-traje-ciscenje-stana",
      title: "Koliko traje čišćenje stana i šta može da ga uspori",
      description: "Kvadratura nije jedini podatak za trajanje čišćenja. Kako dogovoriti termin u Beogradu uz stanje stana, dodatne poslove i pristup.",
      category: "Planiranje",
      imageAlt: "Ilustracija peščanog sata na drvenoj konzoli u osunčanom stanu",
      lead: "Želite da smestite čišćenje između dva sastanka i znate kada možete da krenete. Kvadratura daje samo deo odgovora. Trajanje zavisi od zadataka, pristupa i stanja kuhinje i kupatila.",
      sections: [
        {
          id: "area",
          title: "Zašto kvadratura nije dovoljna",
          paragraphs: [
            "Prazna soba i soba puna sitnica mogu biti iste veličine. U drugoj ima manje slobodnih površina i više pažljivog rada oko predmeta. Broj kupatila i intenzivno korišćena kuhinja takođe menjaju obim.",
            "Iskustvo prijatelja da je sve završeno za nekoliko sati nije rok za vaš stan. Mogu se razlikovati format, dodaci i broj ljudi u timu. LumaClean kalkulator procenjuje cenu, ne trajanje."
          ]
        },
        {
          id: "extras",
          title: "Uračunajte dodatke",
          paragraphs: [
            "Prozori, rerna, frižider i ormarići iznutra zasebni su zadaci. Ako ih dodate tokom posete, prvobitni plan vremena možda više ne važi. Važni su i stanje i broj zona.",
            "Recite šta mora biti gotovo tog dana. Ako je vreme kratko, razgovarajte o pomeranju manje važnih dodataka. Zahtev da se samo radi brže ne rešava pitanje da li ceo posao staje u raspoloživi period."
          ]
        },
        {
          id: "delays",
          title: "Uklonite prepreke pre dolaska",
          paragraphs: [
            "Vreme se gubi i pre početka rada: na traženje ulaza, čekanje ključa ili otvaranje nedostupnog ormara. Omogućite da dogovoreni posao počne po dolasku."
          ],
          bullets: [
            "Pošaljite ulaz, sprat i način pristupa.",
            "Oslobodite površine koje se čiste.",
            "Pripremite ohlađenu rernu i prazne dogovorene ormariće.",
            "Najavite druge radove ili ljude u stanu.",
            "Ostavite kontakt za pitanja."
          ],
          tip: "Ne zakažite dolazak tima tačno za trenutak kada majstori ili selidba treba da završe."
        },
        {
          id: "window",
          title: "Dogovorite realan vremenski okvir",
          paragraphs: [
            "Pošaljite površinu, fotografije, format i dodatke. Pored željenog početka navedite i obavezni kraj, ako postoji. Zatražite potvrdu da posao može da se uklopi.",
            "Ako se stanje promenilo posle procene, javite unapred. Lakše je prilagoditi plan pre posete. Sajt ne daje univerzalno trajanje za sve stanove; vreme se dogovara za konkretan obim."
          ]
        }
      ]
    },
    en: {
      slug: "how-long-apartment-cleaning-takes",
      title: "How long does apartment cleaning take, and what can delay it?",
      description: "Why cleaning time depends on more than floor area. Agree a realistic appointment window in Belgrade around condition, extras and access.",
      category: "Planning",
      imageAlt: "Illustration of an hourglass on an oak console in a sunlit apartment",
      lead: "You want to fit cleaning between two appointments and know when you can leave. Floor area is only part of the answer. The task list, access and condition of the kitchen and bathroom all affect the time needed.",
      sections: [
        {
          id: "area",
          title: "Why floor area is not enough",
          paragraphs: [
            "An empty room and a room full of small objects may be the same size. The second has fewer clear surfaces and requires more careful work around belongings. Multiple bathrooms and a heavily used kitchen also change the workload.",
            "A friend's report that their home took a couple of hours is not a timetable for yours. The service, extras and team size may differ. LumaClean's calculator estimates price, not duration."
          ]
        },
        {
          id: "extras",
          title: "Allow for additional tasks",
          paragraphs: [
            "Windows, oven and fridge interiors, and cupboards are separate jobs. Adding them after work starts can make the original time plan unrealistic. Both condition and the number of areas matter.",
            "Explain what must be completed that day. If time is limited, discuss moving optional extras to another booking. Simply asking the team to hurry does not establish whether the full scope will fit."
          ]
        },
        {
          id: "delays",
          title: "Remove avoidable delays",
          paragraphs: [
            "Time can be lost before cleaning begins: finding the entrance, waiting for keys or discovering an inaccessible cupboard. Make it possible to start the agreed work on arrival."
          ],
          bullets: [
            "Share the entrance, floor and access arrangement.",
            "Clear the surfaces being cleaned.",
            "Have the oven cool and agreed cupboards empty.",
            "Mention other work or people in the apartment.",
            "Leave a reachable contact."
          ],
          tip: "Avoid booking cleaners for the exact moment movers or tradespeople are expected to finish."
        },
        {
          id: "window",
          title: "Agree a realistic appointment window",
          paragraphs: [
            "Send the area, photographs, service and extras. Give any fixed finishing deadline as well as your preferred start. Ask whether the available window suits the work.",
            "Tell the team if the apartment's condition changes after the estimate. Adjusting plans beforehand is easier than discovering a shortfall on arrival. The website has no universal duration for every apartment; confirm it for your particular booking."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/duration.webp"
};
