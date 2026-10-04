import type {Article} from "./types";

export const office: Article = {
  id: "office",
  services: [
    "office"
  ],
  relatedIds: [
    "choose",
    "duration",
    "kitchen"
  ],
  translations: {
    ru: {
      slug: "spisok-rabot-dlya-uborki-ofisa",
      title: "Уборка небольшого офиса: как составить список работ",
      description: "Что включить в уборку небольшого офиса в Белграде: рабочие места, полы, санузел и кухня. Как согласовать документы, доступ и повторяющийся график.",
      category: "Офис",
      imageAlt: "Иллюстрация небольшого офиса с дубовыми столами и бирюзовыми стульями",
      lead: "В небольшом офисе уборку часто заказывает тот, у кого первым закончилась терпимость к пыли. Но у сотрудников разные ожидания: одному нужен чистый стол, другому — кухня, а третий не хочет, чтобы трогали его бумаги. Короткий общий список снимает большую часть этих вопросов.",
      sections: [
        {
          id: "zones",
          title: "Разделите офис на рабочие и общие зоны",
          paragraphs: [
            "Запишите количество рабочих мест, санузлов и кухонных зон. Площадь нужна для расчёта, но два офиса одинакового размера могут заметно различаться по объёму: пустая переговорная и комната с плотно стоящими столами убираются по-разному.",
            "У LumaClean есть формат для небольших офисов и студий. Он включает доступные поверхности, полы, санузел, кухонную зону, мусор, ручки и выключатели в рамках согласованного списка. Промышленные и специализированные помещения к этому формату не относятся."
          ],
          bullets: [
            "Рабочие места: доступные участки столов и пол.",
            "Общие зоны: переговорная, вход и проходы.",
            "Кухня: согласованные поверхности, раковина и пол.",
            "Санузел: сантехника, зеркало и доступные поверхности."
          ]
        },
        {
          id: "desks",
          title: "Попросите сотрудников освободить столы",
          paragraphs: [
            "Бумаги, техника и личные вещи не должны менять место без договорённости. До визита предложите убрать документы в ящики, а кружки — в согласованную зону. Стопку бумаг лучше оставить нетронутой, чем случайно нарушить рабочий порядок.",
            "Отдельно укажите, что нельзя трогать: оборудование, провода, доску с записями, образцы продукции. Протирание доступного стола не означает очистку клавиатуры изнутри или обслуживание компьютера."
          ]
        },
        {
          id: "access",
          title: "Назначьте одного человека для связи",
          paragraphs: [
            "Выберите контакт, который подтвердит список и сможет ответить во время визита. Сообщите правила входа, доступа в отдельные комнаты и выхода из офиса. Если уборка нужна вне рабочего времени, назовите желаемый промежуток и дождитесь подтверждения слота.",
            "Не передавайте разные указания через нескольких сотрудников. Новая просьба на месте может потребовать времени или изменить стоимость; её удобнее согласовать через ответственного человека."
          ],
          tip: "Список «каждый визит» держите отдельно от разовых задач: холодильник внутри или окна не должны появляться в заказе неожиданно."
        },
        {
          id: "repeat",
          title: "Проверьте список после первой уборки",
          paragraphs: [
            "Посмотрите, хватает ли внимания кухне и входной зоне и остаётся ли доступ к рабочим местам. По результату можно согласовать периодичность и повторяющийся набор задач. После перестановки или увеличения команды список стоит пересмотреть.",
            "В заявке укажите район Белграда, площадь, число рабочих мест и санузлов, желаемое время и дополнительные работы. Если нужны определённые документы для оплаты или особый режим доступа, уточните это до заказа — статья не заменяет подтверждение этих условий."
          ]
        }
      ]
    },
    sr: {
      slug: "plan-ciscenja-male-kancelarije",
      title: "Čišćenje male kancelarije: kako sastaviti spisak poslova",
      description: "Plan čišćenja male kancelarije u Beogradu: radna mesta, zajedničke zone, kuhinja i toalet. Dogovor o dokumentima, pristupu i redovnim dolascima.",
      category: "Kancelarija",
      imageAlt: "Ilustracija male kancelarije sa drvenim stolovima i tirkiznim stolicama",
      lead: "Jednom kolegi smeta prašina na stolu, drugom kuhinja, a treći ne želi da mu se pomeraju papiri. Pre zakazivanja čišćenja male kancelarije vredi sastaviti zajednički spisak. Tako se očekivanja ne prenose timu tek tokom rada.",
      sections: [
        {
          id: "zones",
          title: "Odvojite radne i zajedničke zone",
          paragraphs: [
            "Navedite broj radnih mesta, toaleta i kuhinjskih zona. Kvadratura je potrebna, ali prazna sala i soba puna stolova nisu isti obim posla.",
            "LumaClean nudi format za male kancelarije i studije: dostupne površine, podove, toalet, kuhinjsku zonu, otpad, kvake i prekidače prema dogovorenom spisku. Industrijski i specijalizovani prostori nisu deo tog formata."
          ],
          bullets: [
            "Radna mesta: dostupni delovi stolova i pod.",
            "Zajedničke zone: ulaz, prolazi i sala.",
            "Kuhinja: dogovorene površine, sudopera i pod.",
            "Toalet: sanitarije, ogledalo i dostupne površine."
          ]
        },
        {
          id: "desks",
          title: "Zamolite kolege da oslobode stolove",
          paragraphs: [
            "Papiri, oprema i lične stvari ne pomeraju se bez dogovora. Predložite da se dokumenti sklone u fioke, a šolje na određeno mesto. Bolje je ostaviti gomilu papira netaknutom nego poremetiti nečiji posao.",
            "Navedite šta se ne dira: uređaji, kablovi, tabla sa beleškama ili uzorci. Brisanje stola ne podrazumeva rastavljanje tastature ili održavanje računara."
          ]
        },
        {
          id: "access",
          title: "Odredite jednu kontakt osobu",
          paragraphs: [
            "Jedna osoba treba da potvrdi spisak i odgovara na pitanja. Objasnite ulazak, pristup sobama i izlazak iz kancelarije. Za dolazak van radnog vremena navedite željeni period i sačekajte potvrdu termina.",
            "Izbegnite različita uputstva više kolega. Dodatna molba može promeniti vreme ili cenu, pa je lakše potvrditi je preko odgovorne osobe."
          ],
          tip: "Odvojite redovne zadatke od povremenih dodataka, poput frižidera iznutra ili prozora."
        },
        {
          id: "repeat",
          title: "Proverite plan posle prvog dolaska",
          paragraphs: [
            "Pogledajte da li kuhinja i ulaz dobijaju dovoljno pažnje i jesu li stolovi dostupni. Zatim dogovorite učestalost i ponavljajući spisak. Plan preispitajte posle preuređenja ili promene broja zaposlenih.",
            "U upitu navedite deo Beograda, površinu, radna mesta, toalete, vreme i dodatke. Posebnu dokumentaciju za plaćanje ili pravila pristupa proverite pre zakazivanja; nemojte ih podrazumevati."
          ]
        }
      ]
    },
    en: {
      slug: "small-office-cleaning-checklist",
      title: "Small office cleaning: how to agree a useful task list",
      description: "Plan small office cleaning in Belgrade around desks, shared areas, kitchen and washroom. Agree document handling, access and recurring tasks.",
      category: "Office",
      imageAlt: "Illustration of a small office with oak desks and teal chairs",
      lead: "One colleague wants a dust-free desk, another cares most about the kitchen, and a third does not want anyone moving their papers. A shared task list helps settle those expectations before the cleaners arrive.",
      sections: [
        {
          id: "zones",
          title: "Separate desks from shared areas",
          paragraphs: [
            "List workstations, washrooms and kitchen areas. Floor area matters, but an empty meeting room and a room packed with desks involve different work.",
            "LumaClean's small-office and studio format covers accessible surfaces, floors, washrooms, the kitchen area, waste, handles and switches against an agreed list. It does not cover industrial or specialist premises."
          ],
          bullets: [
            "Desks: accessible worktop areas and floors.",
            "Shared areas: entrance, walkways and meeting room.",
            "Kitchen: agreed surfaces, sink and floor.",
            "Washroom: fittings, mirror and accessible surfaces."
          ]
        },
        {
          id: "desks",
          title: "Ask staff to clear their workspaces",
          paragraphs: [
            "Documents, equipment and personal belongings should not move without agreement. Ask colleagues to put papers away and leave mugs in an agreed area. An untouched stack of papers is preferable to disrupted work.",
            "Identify equipment, cables, notes on boards or samples that should be left alone. Wiping an accessible desk does not mean dismantling a keyboard or servicing a computer."
          ]
        },
        {
          id: "access",
          title: "Choose one contact person",
          paragraphs: [
            "Have one person confirm the list and answer questions. Explain entry, restricted rooms and leaving arrangements. If you need an out-of-hours appointment, request the time window and wait for confirmation.",
            "Avoid conflicting directions from several staff members. An added task can change the time or price and is easier to confirm through the responsible contact."
          ],
          tip: "Keep recurring tasks separate from occasional extras such as fridge interiors or windows."
        },
        {
          id: "repeat",
          title: "Review after the first visit",
          paragraphs: [
            "Check whether the kitchen and entrance get enough attention and desks remain accessible. Then agree a recurring list and frequency. Review it after a layout change or an increase in staff.",
            "Include the Belgrade neighbourhood, area, workstations, washrooms, preferred time and extras in your enquiry. Ask about any required payment documents or special access procedures before booking rather than assuming they are available."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/office.webp"
};
