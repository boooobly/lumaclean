import type {Article} from "./types";

export const moveOut: Article = {
  id: "move-out",
  services: [
    "move"
  ],
  relatedIds: [
    "move-in",
    "kitchen",
    "windows"
  ],
  translations: {
    ru: {
      slug: "uborka-pered-sdachey-kvartiry",
      title: "Уборка перед сдачей съёмной квартиры: что проверить до передачи ключей",
      description: "Как спланировать уборку после выезда из квартиры в Белграде: вещи, техника, шкафы, осмотр и передача ключей. Без обещаний возврата депозита.",
      category: "Переезд",
      imageAlt: "Иллюстрация пустой квартиры с ключами у открытой двери",
      lead: "Коробки уже уехали, но квартира ещё не готова к передаче. На месте дивана осталась пыль, в холодильнике — продукты, а в шкафу — забытая полка с вещами. Уборку перед сдачей удобнее планировать на время после вывоза вещей и до встречи с владельцем.",
      sections: [
        {
          id: "expectations",
          title: "Начните со списка для передачи",
          paragraphs: [
            "Уточните с владельцем, в каком состоянии он ожидает квартиру. Речь не только о чистоте: где должны лежать ключи, какая мебель остаётся, что делать с оставленными расходниками. Сохраните договорённости, чтобы в день выезда не решать всё заново.",
            "Уборка устраняет загрязнения, но не ремонтирует сколы, царапины или повреждённые покрытия. Такие места лучше заметить и обсудить отдельно. Не рассчитывайте, что более интенсивное оттирание скроет износ."
          ]
        },
        {
          id: "empty",
          title: "Освободите то, что будут мыть внутри",
          paragraphs: [
            "Если в заказ входят внутренние поверхности, сначала выньте вещи из шкафов и продукты из холодильника. Посмотрите верхние полки, ящики под кроватью и пространство за дверями. Оставшиеся вещи легко принять за то, что нужно сохранить на месте.",
            "Отдельно решите, кто уберёт упаковку и ненужную мебель. Вывоз коробок и крупного мусора не следует считать частью уборки без договорённости."
          ],
          bullets: [
            "Вывезите личные вещи до начала визита.",
            "Отметьте предметы, которые остаются владельцу.",
            "Согласуйте холодильник, духовку и шкафы внутри.",
            "Предупредите, если в квартире уже отключены вода или электричество."
          ]
        },
        {
          id: "scope",
          title: "Согласуйте формат после выезда",
          paragraphs: [
            "У LumaClean есть уборка при въезде и выезде. При обращении сообщите, пустая ли квартира, осталась ли мебель и когда назначена передача. Фотографии после вывоза вещей точнее показывают объём, чем старые кадры обставленной комнаты.",
            "Окна, балкон и техника внутри выбираются отдельно. Если обнаружились следы ремонта, плесень или последствия протечки, опишите их до заказа: это не задачи обычной уборки при переезде."
          ],
          tip: "Оставьте между окончанием уборки и передачей ключей время на спокойный осмотр. Не ставьте обе встречи на одну минуту."
        },
        {
          id: "handover",
          title: "Пройдите квартиру перед встречей",
          paragraphs: [
            "Осмотрите кухню, санузел, доступные поверхности и места, которые отдельно включили в заказ. Проверьте, не остались ли ваши вещи, и верните ключи в согласованном порядке. Фотографии общего состояния помогут сохранить понятную запись того, как выглядела квартира при передаче.",
            "Не связывайте оплату клининга с обещанием возврата депозита. Решение о депозите зависит от ваших договорённостей с владельцем и состояния жилья в целом; уборка отвечает только за согласованный объём работ."
          ]
        }
      ]
    },
    sr: {
      slug: "ciscenje-pre-predaje-stana",
      title: "Čišćenje pre predaje iznajmljenog stana: šta proveriti",
      description: "Plan čišćenja posle iseljenja u Beogradu: stvari, uređaji, ormari i pregled pre predaje ključeva. Šta dogovoriti sa vlasnikom i timom.",
      category: "Selidba",
      imageAlt: "Ilustracija praznog stana sa ključevima pored otvorenih vrata",
      lead: "Kutije su odnete, ali stan još nije spreman za predaju. Iza sofe je ostala prašina, u frižideru hrana, a na gornjoj polici nekoliko stvari. Čišćenje je najlakše organizovati posle iznošenja stvari, a pre susreta sa vlasnikom.",
      sections: [
        {
          id: "expectations",
          title: "Dogovorite šta se predaje",
          paragraphs: [
            "Pitajte vlasnika kakvo stanje očekuje i šta ostaje u stanu. Proverite nameštaj, ključeve i preostale potrepštine. Sačuvajte dogovor da ne biste sve rešavali u poslednjem trenutku.",
            "Čišćenje uklanja prljavštinu, ali ne popravlja ogrebotine, okrnjene ivice i oštećene premaze. Takva mesta izdvojite za razgovor; jače ribanje nije način da se prikrije habanje."
          ]
        },
        {
          id: "empty",
          title: "Ispraznite površine koje se čiste iznutra",
          paragraphs: [
            "Ako ste dogovorili unutrašnjost ormara ili frižidera, prvo izvadite stvari i hranu. Proverite visoke police, fioke ispod kreveta i prostor iza vrata. Zaostale predmete tim može razumljivo ostaviti netaknute.",
            "Unapred rešite ko odnosi ambalažu i nepotreban nameštaj. Odvoz kutija i krupnog otpada nemojte podrazumevati kao deo čišćenja."
          ],
          bullets: [
            "Lične stvari iznesite pre dolaska tima.",
            "Označite šta ostaje vlasniku.",
            "Posebno dogovorite rernu, frižider i ormariće iznutra.",
            "Javite ako su voda ili struja već isključene."
          ]
        },
        {
          id: "scope",
          title: "Opišite stan posle iseljenja",
          paragraphs: [
            "LumaClean ima format za useljenje i iseljenje. Navedite da li je stan prazan, koji nameštaj ostaje i kada je predaja. Fotografije nakon iznošenja stvari bolje pokazuju posao od starih slika nameštenog prostora.",
            "Prozori, balkon i unutrašnjost uređaja biraju se posebno. Tragove renoviranja, buđ ili posledice curenja prijavite pre zakazivanja; to nisu zadaci uobičajenog čišćenja pri selidbi."
          ],
          tip: "Ostavite vreme za pregled između završetka čišćenja i predaje ključeva."
        },
        {
          id: "handover",
          title: "Pregledajte dogovorene zone",
          paragraphs: [
            "Prođite kuhinju, kupatilo i mesta posebno navedena u poruci. Proverite da niste zaboravili stvari i vratite ključeve prema dogovoru. Fotografije mogu sačuvati jasan prikaz stanja pri predaji.",
            "Čišćenje nije garancija vraćanja depozita. To zavisi od dogovora sa vlasnikom i ukupnog stanja stana. Uloga tima je da obavi potvrđene poslove čišćenja."
          ]
        }
      ]
    },
    en: {
      slug: "move-out-cleaning-checklist",
      title: "Move-out cleaning: what to check before handing back the keys",
      description: "Plan move-out cleaning in Belgrade around belongings, appliance interiors and the final walkthrough. A practical checklist for handing back a rented apartment.",
      category: "Moving",
      imageAlt: "Illustration of an empty apartment with keys beside an open door",
      lead: "The boxes have gone, but the apartment is not quite ready to hand back. There is dust where the sofa stood, food in the fridge and a forgotten shelf of belongings. Schedule cleaning after the move and before meeting the landlord.",
      sections: [
        {
          id: "expectations",
          title: "Agree what is being handed back",
          paragraphs: [
            "Ask the landlord what condition they expect and what should remain. Check furniture, keys and leftover household supplies. Keep the agreement together so these decisions do not fall to moving day.",
            "Cleaning removes dirt; it does not repair chips, scratches or damaged finishes. Identify those separately. Scrubbing harder is not a way to conceal wear."
          ]
        },
        {
          id: "empty",
          title: "Empty anything booked for cleaning inside",
          paragraphs: [
            "If cupboard or fridge interiors are included in your booking, remove belongings and food first. Check high shelves, under-bed drawers and spaces behind doors. Items left behind may reasonably be treated as things that should stay untouched.",
            "Decide who will remove packaging and unwanted furniture. Do not assume boxes or bulky waste will be taken away as part of cleaning."
          ],
          bullets: [
            "Move personal belongings before the visit.",
            "Identify items that stay with the apartment.",
            "Agree oven, fridge and cupboard interiors separately.",
            "Mention if water or electricity has already been disconnected."
          ]
        },
        {
          id: "scope",
          title: "Describe the apartment after the move",
          paragraphs: [
            "LumaClean offers a move-in and move-out format. Explain whether the apartment is empty, which furniture remains and when the handover is planned. Photographs after the move show the work more clearly than older furnished views.",
            "Windows, the balcony and appliance interiors are separate selections. Mention renovation residue, mould or leak damage before booking; these are outside ordinary move-out cleaning."
          ],
          tip: "Leave time for a walkthrough between the end of cleaning and the key handover."
        },
        {
          id: "handover",
          title: "Check the agreed areas",
          paragraphs: [
            "Walk through the kitchen, bathroom and any areas specifically included in the booking. Check for forgotten belongings and return keys as agreed. Photographs can keep a clear record of the apartment at handover.",
            "Cleaning cannot guarantee the return of a rental deposit. That depends on your agreement with the landlord and the overall condition of the property. The cleaning team's responsibility is the agreed cleaning work."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/move-out.webp"
};
