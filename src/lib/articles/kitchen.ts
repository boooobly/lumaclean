import type {Article} from "./types";

export const kitchen: Article = {
  id: "kitchen",
  services: [
    "regular",
    "deep"
  ],
  relatedIds: [
    "regular-deep",
    "cost",
    "airbnb"
  ],
  translations: {
    ru: {
      slug: "uborka-kuhni-chto-vhodit",
      title: "Уборка кухни: что мыть снаружи, а что заказывать отдельно",
      description: "Разбираем уборку кухни по зонам: столешница, фасады, духовка, холодильник и шкафы. Какие внутренние поверхности нужно включить в заказ отдельно.",
      category: "Кухня",
      imageAlt: "Иллюстрация светлой кухни с духовкой и бирюзовой кастрюлей",
      lead: "После уборки кухня может выглядеть аккуратно, а внутри духовки останется нагар. Это не обязательно пропущенная работа: наружные поверхности и техника внутри — разные задачи. Лучше разделить их ещё при заказе.",
      sections: [
        {
          id: "outside",
          title: "Составьте список наружных поверхностей",
          paragraphs: [
            "Посмотрите на рабочую зону, раковину, фасады и пол. Если на них обычные следы приготовления еды, обсудите поддерживающий формат. Липкий слой на фасадах и давно не убранные участки требуют отдельного описания и могут изменить основной формат.",
            "Перед визитом уберите продукты и мелочи со столешницы. Если хотите оставить кофемашину или другой прибор на месте, скажите, нужно ли убирать вокруг него. Не рассчитывайте на разборку техники или перемещение тяжёлых устройств без согласования."
          ]
        },
        {
          id: "inside",
          title: "Отдельно назовите духовку, холодильник и шкафы",
          paragraphs: [
            "В LumaClean внутренние поверхности этих трёх зон выбираются как дополнения. Генеральная уборка не добавляет их автоматически. Укажите, что именно нужно: пустые полки холодильника, камера духовки или конкретные шкафы.",
            "Покажите состояние на фото. Засохший разлив в холодильнике и обычное протирание полок — не одинаковая работа. Уточните, какие съёмные детали включены; название опции не означает обслуживание механизма прибора."
          ],
          bullets: [
            "Духовка: покажите камеру и противни, если они тоже нужны.",
            "Холодильник: освободите согласованные полки от продуктов.",
            "Шкафы: выньте содержимое из тех секций, которые будут мыть."
          ]
        },
        {
          id: "prepare",
          title: "Подготовьте технику без спешки",
          paragraphs: [
            "Духовка должна успеть остыть до визита. Продукты из холодильника переложите в подходящее место самостоятельно, а отключение и разморозку обсуждайте по инструкции конкретного прибора. Не оставляйте эту задачу неожиданностью для команды.",
            "Если в шкафах хранится посуда или открытые продукты, заранее освободите нужные секции. Не обязательно разбирать всю кухню, когда заказ касается двух шкафов. Чем точнее доступ, тем меньше лишнего перемещения вещей."
          ],
          tip: "В сообщении можно написать: «Фасады снаружи, духовка внутри и два пустых нижних шкафа; холодильник не нужен». Это яснее, чем «кухню полностью»."
        },
        {
          id: "materials",
          title: "Предупредите о покрытиях и повреждениях",
          paragraphs: [
            "Натуральный камень, дерево, окрашенные фасады и декоративный металл могут иметь разные ограничения по уходу. Если сохранились рекомендации производителя, передайте их. Потёртость или матовое пятно не всегда являются грязью, которую можно убрать средством.",
            "Для расчёта пришлите общий кадр кухни и детали сложных мест. Уборка помогает с согласованными загрязнениями, но не восстанавливает покрытие и не ремонтирует технику. Спорный участок лучше оценить до работы, чем пытаться любой ценой сделать его блестящим."
          ]
        }
      ]
    },
    sr: {
      slug: "sta-ukljucuje-ciscenje-kuhinje",
      title: "Čišćenje kuhinje: spoljašnje površine i dodatni poslovi iznutra",
      description: "Radna ploča, frontovi, rerna, frižider i ormarići: kako sastaviti zahtev za čišćenje kuhinje i posebno dogovoriti unutrašnje površine.",
      category: "Kuhinja",
      imageAlt: "Ilustracija svetle kuhinje sa rernom i tirkiznom šerpom",
      lead: "Kuhinja može izgledati uredno, a da u rerni ostanu naslage. To ne mora biti propušten posao: spoljašnje površine i unutrašnjost uređaja različiti su zadaci. Razdvojite ih pri dogovoru.",
      sections: [
        {
          id: "outside",
          title: "Navedite spoljašnje površine",
          paragraphs: [
            "Pogledajte radnu zonu, sudoperu, frontove i pod. Za svakodnevne tragove kuvanja razmotrite održavanje. Lepljive naslage na frontovima i dugo zanemarene delove opišite posebno jer mogu promeniti format.",
            "Sklonite hranu i sitnice sa radne ploče. Ako aparat za kafu ostaje na mestu, objasnite da li se čisti oko njega. Rastavljanje uređaja i pomeranje teške opreme ne podrazumevaju se bez dogovora."
          ]
        },
        {
          id: "inside",
          title: "Posebno dodajte unutrašnjost",
          paragraphs: [
            "Kod LumaClean-a rerna, frižider i ormarići iznutra biraju se kao dodaci. Generalno čišćenje ih ne uključuje automatski. Navedite da li su potrebne police frižidera, komora rerne ili određeni ormarići.",
            "Pošaljite fotografije. Osušeno prosipanje nije isti posao kao brisanje prazne police. Proverite koje uklonjive delove obuhvata dogovor; naziv dodatka ne znači servisiranje mehanizma."
          ],
          bullets: [
            "Rerna: pokažite i plehove ako ih želite uključiti.",
            "Frižider: izvadite hranu sa dogovorenih polica.",
            "Ormarići: ispraznite odabrane delove."
          ]
        },
        {
          id: "prepare",
          title: "Pripremite uređaje na vreme",
          paragraphs: [
            "Rerna treba da se ohladi pre dolaska. Hranu sami premestite na odgovarajuće mesto, a isključivanje i odmrzavanje razjasnite prema uputstvu uređaja. Nemojte ostaviti takvu obavezu kao iznenađenje timu.",
            "Ako se čiste samo dva ormarića, nema potrebe prazniti celu kuhinju. Oslobodite upravo dogovorene delove da bi se izbeglo nepotrebno premeštanje."
          ],
          tip: "„Frontovi spolja, rerna iznutra i dva prazna donja ormarića” jasnije opisuje posao od „cela kuhinja”."
        },
        {
          id: "materials",
          title: "Pomenite osetljive materijale",
          paragraphs: [
            "Kamen, drvo, obojeni frontovi i dekorativni metal mogu tražiti različitu negu. Prosledite uputstva proizvođača ako ih imate. Mat trag ili pohabanost nisu uvek prljavština.",
            "Za procenu pošaljite celu kuhinju i detalje zahtevnih mesta. Čišćenje ne obnavlja završni sloj i ne popravlja uređaje. Nejasno mesto prvo treba proceniti, bez obećanja da će ponovo zablistati."
          ]
        }
      ]
    },
    en: {
      slug: "kitchen-cleaning-checklist",
      title: "Kitchen cleaning: exterior surfaces and the extras inside",
      description: "Worktops, cabinet fronts, ovens, fridges and cupboards: describe your kitchen cleaning needs and agree appliance interiors separately.",
      category: "Kitchen",
      imageAlt: "Illustration of a pale kitchen with a built-in oven and teal cooking pot",
      lead: "A kitchen can look tidy while the oven still has baked-on residue. That is not necessarily missed work: exterior surfaces and appliance interiors are different tasks. Separate them when booking.",
      sections: [
        {
          id: "outside",
          title: "List the exterior surfaces",
          paragraphs: [
            "Look at the work area, sink, cabinet fronts and floor. Everyday cooking marks may suit regular cleaning. Describe sticky deposits and long-neglected areas separately, as they can change the service needed.",
            "Clear food and small objects from the counter. If a coffee machine will stay in place, explain whether you want the area around it cleaned. Do not assume appliances will be dismantled or heavy equipment moved without agreement."
          ]
        },
        {
          id: "inside",
          title: "Name each interior you need",
          paragraphs: [
            "LumaClean lists oven, fridge and cupboard interiors as extras. Deep cleaning does not automatically add them. Specify shelves, the oven cavity or particular cupboards rather than simply asking for the whole kitchen.",
            "Send photographs of the condition. A dried spill is different from a routine shelf wipe. Clarify any removable parts; the extra is not mechanical servicing."
          ],
          bullets: [
            "Oven: show trays too if you want them included.",
            "Fridge: remove food from the agreed shelves.",
            "Cupboards: empty the sections being cleaned."
          ]
        },
        {
          id: "prepare",
          title: "Prepare appliances in good time",
          paragraphs: [
            "Allow the oven to cool before the visit. Move food to a suitable place yourself, and clarify disconnection or defrosting using the appliance instructions. Do not leave those tasks as a surprise for the team.",
            "You need not empty the entire kitchen when only two cupboards are booked. Make the agreed sections accessible to avoid unnecessary handling of belongings."
          ],
          tip: "“Exterior fronts, the oven inside and two empty lower cupboards” is clearer than “the complete kitchen”."
        },
        {
          id: "materials",
          title: "Mention sensitive finishes",
          paragraphs: [
            "Stone, wood, painted fronts and decorative metal can have different care requirements. Share manufacturer instructions if available. A dull patch or worn area is not always dirt.",
            "Send a full kitchen view and details of difficult areas for the estimate. Cleaning does not restore finishes or repair appliances. An uncertain patch should be assessed first, rather than scrubbed in an attempt to make it shine."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/kitchen.webp"
};
