import type {Article} from "./types";

export const airbnb: Article = {
  id: "airbnb",
  services: [
    "airbnb"
  ],
  relatedIds: [
    "kitchen",
    "duration",
    "prepare"
  ],
  translations: {
    ru: {
      slug: "uborka-airbnb-mezhdu-gostyami",
      title: "Уборка Airbnb между гостями: чек-лист для хозяина квартиры",
      description: "Как организовать уборку квартиры для краткосрочной аренды в Белграде: время между заездами, бельё, кухня, санузел и проверка перед гостями.",
      category: "Краткосрочная аренда",
      imageAlt: "Иллюстрация гостевой кровати с чистым бельём и бирюзовой подушкой",
      lead: "Гости выезжают утром, следующие приезжают днём. В таком расписании легко забыть мелочь: чистое бельё лежит в закрытом шкафу, ключ остался у прошлого гостя, а холодильник никто не включил в заказ. Повторяющийся список работ помогает не собирать уборку заново перед каждым заездом.",
      sections: [
        {
          id: "time",
          title: "Сначала подтвердите доступ и время",
          paragraphs: [
            "Передайте команде не только время следующего заезда, но и момент, когда квартира действительно освободится. Поздний выезд сокращает время на работу. Если гость ещё не ушёл, предупредите об этом сразу, а не после приезда клинеров.",
            "Укажите способ передачи ключей, этаж, домофон и контакт человека, который сможет ответить на вопрос. Код доступа храните в личной переписке с исполнителем. Наличие свободного промежутка в календаре бронирований ещё не подтверждает доступность команды."
          ]
        },
        {
          id: "checklist",
          title: "Сделайте постоянный список по зонам",
          paragraphs: [
            "Для короткой аренды важен повторяемый результат. Зафиксируйте, какие поверхности и комнаты входят в обычный визит, и отдельно отмечайте изменения после конкретных гостей. Сильное загрязнение кухни или пятно на диване лучше показать заранее.",
            "У LumaClean формат Airbnb включает комнаты и доступные поверхности, полы, рабочую зону кухни и фасады снаружи, санузел и финальную визуальную проверку. Внутренние поверхности техники, окна и балкон согласуются дополнительно."
          ],
          bullets: [
            "Кухня: рабочая зона, раковина, наружные фасады.",
            "Санузел: сантехника, зеркало, согласованные стеклянные поверхности.",
            "Комнаты: доступные поверхности и пол.",
            "В конце: проверить выполнение списка и общий вид."
          ]
        },
        {
          id: "linen",
          title: "Подготовьте чистые комплекты белья",
          paragraphs: [
            "Смена подготовленного белья доступна как дополнительная работа. Оставьте комплект в известном месте и укажите, для какой кровати он предназначен. Если размеры различаются, подпишите место хранения или пришлите понятную фотографию.",
            "Заранее решите, куда сложить использованное бельё. Стирка, покупка расходников и заселение гостей не должны автоматически попадать в этот заказ. Если такие задачи нужны, обсудите их отдельно и дождитесь подтверждения."
          ],
          tip: "Сохраните фото аккуратно подготовленной кровати как ориентир для вашей квартиры. Это удобнее, чем каждый раз объяснять расположение подушек словами."
        },
        {
          id: "finish",
          title: "Оставьте время на проверку перед заездом",
          paragraphs: [
            "После уборки хозяину полезно проверить не только чистоту: есть ли ключи, работает ли освещение, подготовлены ли вещи для гостя. Эти хозяйские задачи не заменяются визуальным осмотром клинеров.",
            "Не назначайте окончание уборки и приезд гостя на одно время. Если между бронированиями совсем нет запаса, сначала согласуйте реальную возможность визита. Чтобы получить расчёт, сообщите площадь, адрес, число спальных мест, нужные дополнения и оба времени — выезда и заезда."
          ]
        }
      ]
    },
    sr: {
      slug: "ciscenje-apartmana-izmedju-gostiju",
      title: "Čišćenje Airbnb apartmana između gostiju: spisak za domaćina",
      description: "Organizujte čišćenje apartmana u Beogradu između rezervacija: pristup, posteljina, kuhinja, kupatilo i provera pre dolaska gostiju.",
      category: "Kratkoročni najam",
      imageAlt: "Ilustracija gostinskog kreveta sa čistom posteljinom i tirkiznim jastukom",
      lead: "Jedni gosti odlaze ujutru, drugi stižu popodne. U tom rasporedu lako se zaboravi ključ, čista posteljina ili unutrašnjost frižidera. Stalan spisak poslova štedi dogovaranje od početka pri svakoj smeni.",
      sections: [
        {
          id: "time",
          title: "Potvrdite kada je stan slobodan",
          paragraphs: [
            "Tim treba da zna i vreme ulaska novih gostiju i trenutak kada prethodni zaista odlaze. Kasni odlazak skraćuje raspoloživo vreme. Ako su gosti još unutra, javite pre dolaska tima.",
            "Pošaljite način preuzimanja ključa, sprat, interfon i kontakt osobu. Kodove delite privatno sa izvođačem. Slobodan termin u kalendaru rezervacija nije sam po sebi potvrda dostupnosti tima."
          ]
        },
        {
          id: "checklist",
          title: "Napravite spisak po prostorijama",
          paragraphs: [
            "Dogovorite šta se ponavlja pri svakom dolasku, a zatim dodajte promene posle konkretnih gostiju. Jače zaprljanu kuhinju ili mrlju na sofi pokažite unapred.",
            "LumaClean Airbnb format obuhvata sobe, dostupne površine, podove, kuhinjsku radnu zonu i frontove spolja, kupatilo i završnu vizuelnu proveru. Unutrašnjost uređaja, prozori i balkon dogovaraju se kao dodaci."
          ],
          bullets: [
            "Kuhinja: radna zona, sudopera, spoljašnji frontovi.",
            "Kupatilo: sanitarije, ogledalo i dogovorene staklene površine.",
            "Sobe: dostupne površine i pod.",
            "Na kraju: proveriti spisak i opšti izgled."
          ]
        },
        {
          id: "linen",
          title: "Ostavite spremnu posteljinu",
          paragraphs: [
            "Promena pripremljene posteljine je dodatna usluga. Ostavite komplet na poznatom mestu i navedite za koji je krevet. Ako su dimenzije različite, fotografija ili oznaka mesta za odlaganje olakšava posao.",
            "Dogovorite gde ide korišćena posteljina. Pranje veša, kupovina potrepština i prijem gostiju ne ulaze automatski u ovaj posao. Ako su potrebni, pitajte odvojeno i sačekajte potvrdu."
          ],
          tip: "Fotografija pripremljenog kreveta u vašem apartmanu može poslužiti kao jasan primer željenog rasporeda."
        },
        {
          id: "finish",
          title: "Predvidite završnu proveru",
          paragraphs: [
            "Domaćin treba da proveri i ključeve, rasvetu i stvari za goste. To su zadaci upravljanja smeštajem koje vizuelna provera čistoće ne zamenjuje.",
            "Ne planirajte dolazak gostiju u istom trenutku kada se završava čišćenje. Za procenu pošaljite kvadraturu, adresu, broj kreveta, dodatke i vreme odlaska i dolaska. Ako je razmak kratak, prvo proverite da li je posao izvodljiv."
          ]
        }
      ]
    },
    en: {
      slug: "airbnb-turnover-cleaning-checklist",
      title: "Airbnb turnover cleaning: a checklist for apartment hosts",
      description: "Plan apartment cleaning between guests in Belgrade: access, prepared linen, kitchen and bathroom tasks, and time for a final host check.",
      category: "Short-term rentals",
      imageAlt: "Illustration of a guest bed with folded clean linen and a teal cushion",
      lead: "One booking ends in the morning and the next starts that afternoon. It is easy to overlook a key, a locked linen cupboard or a fridge interior that was never booked. A recurring task list keeps each turnover from becoming a new set of last-minute decisions.",
      sections: [
        {
          id: "time",
          title: "Confirm when the apartment will be empty",
          paragraphs: [
            "Share both the next check-in time and when the previous guests will actually leave. A late checkout reduces the working window. Tell the team promptly if guests are still inside.",
            "Give the key arrangement, floor, entry instructions and a reachable contact. Share access codes privately with the provider. A gap in your booking calendar does not itself confirm the team's availability."
          ]
        },
        {
          id: "checklist",
          title: "Keep a room-by-room list",
          paragraphs: [
            "Agree the work that repeats on every visit, then flag changes after particular guests. Show unusually heavy kitchen dirt or a mark on the sofa in advance.",
            "LumaClean's Airbnb format covers rooms, accessible surfaces, floors, the kitchen work area and exterior fronts, the bathroom and a final visual check. Appliance interiors, windows and the balcony are extras."
          ],
          bullets: [
            "Kitchen: work area, sink and exterior fronts.",
            "Bathroom: fittings, mirror and agreed glass surfaces.",
            "Rooms: accessible surfaces and floors.",
            "Finish: check the agreed list and overall appearance."
          ]
        },
        {
          id: "linen",
          title: "Leave clean sets ready",
          paragraphs: [
            "Changing prepared linen is an optional extra. Leave each set in an agreed place and identify the correct bed. For different bed sizes, a clear photograph or labelled storage location helps avoid confusion.",
            "Agree where used linen should go. Laundry, buying supplies and checking guests in are not automatically part of this booking. Discuss any such tasks separately and wait for confirmation."
          ],
          tip: "A photograph of the prepared bed in your own apartment can serve as a simple guide to the arrangement you want."
        },
        {
          id: "finish",
          title: "Allow time for the host's final check",
          paragraphs: [
            "The host should also check keys, lighting and guest supplies. These property-management tasks are not replaced by the cleaners' visual check of the work.",
            "Avoid scheduling guest arrival for the exact moment cleaning ends. For an estimate, send the area, address, number of beds, extras and both checkout and check-in times. If the gap is tight, confirm feasibility before relying on it."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/airbnb.webp"
};
