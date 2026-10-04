import type {Article} from "./types";

export const windows: Article = {
  id: "windows",
  services: [
    "regular",
    "deep"
  ],
  relatedIds: [
    "cost",
    "move-out",
    "regular-deep"
  ],
  translations: {
    ru: {
      slug: "mytyo-okon-chto-vhodit",
      title: "Мытьё окон в квартире: что входит в заказ и как посчитать окна",
      description: "Как описать окна для расчёта уборки в Белграде: размеры, створки, рамы и доступ. Что уточнить про балкон и нестандартное остекление.",
      category: "Окна",
      imageAlt: "Иллюстрация открытого окна с льняной занавеской и бирюзовой вазой",
      lead: "«У нас три окна» — полезное начало, но для расчёта его мало. Небольшое кухонное окно, широкий блок в гостиной и балконное остекление требуют разного объёма работы. Лучше показать каждый тип и заранее уточнить, как его учитывать.",
      sections: [
        {
          id: "count",
          title: "Считайте оконные блоки, а не комнаты",
          paragraphs: [
            "Пройдите квартиру и запишите, какие окна стоят в каждой комнате. Отметьте количество створок и какие из них открываются. Если рядом с окном есть балконная дверь, включите её в описание, а не оставляйте до дня уборки.",
            "В калькуляторе LumaClean есть стандартное и большое окно. Универсальные размеры этих категорий на сайте не указаны, поэтому для широкого или составного блока лучше отправить фото и примерные габариты. Не нужно самостоятельно делить панорамное остекление на условные маленькие окна."
          ]
        },
        {
          id: "included",
          title: "Уточните стекло, рамы и доступные стороны",
          paragraphs: [
            "При согласовании перечислите то, что хотите вымыть: стекло, рамы, подоконники. Спросите, какие стороны доступны и входят в подтверждённый объём. Москитные сетки, жалюзи и нестандартные конструкции тоже лучше назвать отдельно.",
            "Застеклённый балкон не равен одному большому окну. На балконе могут потребоваться и остекление, и пол, и другие поверхности. В расчёте балкон указан отдельной опцией — уточните обе части задачи."
          ],
          bullets: [
            "Общий кадр каждого типа окна.",
            "Примерная ширина и высота.",
            "Открывающиеся и глухие части.",
            "Сетки, жалюзи и балконная дверь, если они есть."
          ]
        },
        {
          id: "access",
          title: "Покажите, как подойти к окну",
          paragraphs: [
            "Освободите подоконник от растений и мелочей. Сообщите, если окно закрывает тяжёлая мебель или створка не открывается. Перемещение тяжёлых предметов не стоит планировать без отдельного разговора.",
            "Недоступное снаружи стекло не становится обычной задачей из-за того, что оно находится в квартире. LumaClean не предлагает фасадные работы. Сложное остекление сначала оценивают по доступу; не пытайтесь сами добраться до наружной стороны, перегибаясь через окно."
          ],
          tip: "Сфотографируйте окно из комнаты целиком, а не только загрязнение крупным планом. Так будет виден и размер, и доступ."
        },
        {
          id: "booking",
          title: "Добавьте окна к нужному формату уборки",
          paragraphs: [
            "На сайте окна выбираются как дополнение к основному формату. Если нужны только окна, сначала уточните возможность такого заказа; наличие опции в калькуляторе само по себе не обещает отдельный выезд.",
            "Для заявки достаточно площади квартиры, выбранной уборки, списка окон и фотографий. Пятна краски, строительные остатки или повреждённое стекло покажите заранее: обычное мытьё не означает удаление любых следов с любой поверхности."
          ]
        }
      ]
    },
    sr: {
      slug: "sta-ukljucuje-pranje-prozora",
      title: "Pranje prozora u stanu: šta obuhvata i kako prebrojati prozore",
      description: "Šta poslati za procenu pranja prozora u Beogradu: dimenzije, krila, ramovi i pristup. Kako opisati balkon i nestandardno zastakljivanje.",
      category: "Prozori",
      imageAlt: "Ilustracija otvorenog prozora sa lanenom zavesom i tirkiznom vazom",
      lead: "„Imamo tri prozora” nije uvek dovoljno za procenu. Mali kuhinjski prozor, široki blok u dnevnoj sobi i zastakljena terasa nisu isti posao. Fotografija svakog tipa pomaže da se obim dogovori unapred.",
      sections: [
        {
          id: "count",
          title: "Prebrojte prozorske blokove",
          paragraphs: [
            "Zapišite prozore po prostorijama, broj krila i koja se otvaraju. Pomenite balkonska vrata uz prozor, umesto da ih dodajete tek na dan čišćenja.",
            "Kalkulator LumaClean-a razlikuje standardni i veliki prozor. Sajt ne navodi univerzalne dimenzije tih kategorija, pa za široke ili složene blokove pošaljite fotografije i približne mere. Panoramsko staklo nemojte sami deliti na zamišljene male prozore."
          ]
        },
        {
          id: "included",
          title: "Razjasnite staklo, ramove i strane",
          paragraphs: [
            "Navedite da li želite staklo, ramove i prozorske daske i potvrdite koje dostupne strane ulaze u posao. Komarnike, žaluzine i neobične konstrukcije pomenite posebno.",
            "Zastakljena terasa nije automatski jedan veliki prozor. Možda treba očistiti i staklo i pod terase. Balkon je posebna opcija u obračunu, zato dogovorite oba dela."
          ],
          bullets: [
            "Fotografija svakog tipa prozora.",
            "Približna širina i visina.",
            "Krila koja se otvaraju i fiksni delovi.",
            "Komarnici, žaluzine i balkonska vrata."
          ]
        },
        {
          id: "access",
          title: "Pokažite pristup",
          paragraphs: [
            "Sklonite biljke i sitnice sa prozorske daske. Javite ako težak nameštaj zaklanja prozor ili se krilo ne otvara. Pomeranje teških predmeta dogovorite pre dolaska.",
            "Spoljašnje staklo kojem se ne može pristupiti nije običan posao samo zato što pripada stanu. LumaClean ne nudi fasadne radove. Ne pokušavajte da dođete do spoljne strane naginjanjem kroz prozor."
          ],
          tip: "Fotografišite ceo prozor iz sobe, ne samo mrlju. Tako se vide veličina i pristup."
        },
        {
          id: "booking",
          title: "Dodajte prozore osnovnoj usluzi",
          paragraphs: [
            "Na sajtu se prozori biraju uz osnovni format čišćenja. Ako želite samo prozore, prvo proverite mogućnost takvog dolaska; dodatak u kalkulatoru nije potvrda samostalne usluge.",
            "Za upit pošaljite kvadraturu stana, format, spisak prozora i slike. Boju, građevinske ostatke ili oštećeno staklo pokažite unapred. Uobičajeno pranje ne podrazumeva uklanjanje svakog traga sa svake površine."
          ]
        }
      ]
    },
    en: {
      slug: "what-window-cleaning-includes",
      title: "Apartment window cleaning: what to include in your enquiry",
      description: "Describe windows for a cleaning estimate in Belgrade: size, opening sections, frames and access. What to clarify about balconies and unusual glazing.",
      category: "Windows",
      imageAlt: "Illustration of an open window with a linen curtain and teal vase",
      lead: "“We have three windows” is a start, but it may not be enough for an estimate. A small kitchen window, a wide living-room unit and a glazed balcony involve different work. Show each type so the scope can be agreed.",
      sections: [
        {
          id: "count",
          title: "Count window units room by room",
          paragraphs: [
            "Note the number of sections and which ones open. Include an adjoining balcony door in the description rather than mentioning it on the day.",
            "The LumaClean calculator has standard and large window options. The site does not specify universal dimensions for these categories, so send photographs and approximate measurements for wide or complex units. Avoid dividing panoramic glazing into imaginary small windows yourself."
          ]
        },
        {
          id: "included",
          title: "Clarify glass, frames and accessible sides",
          paragraphs: [
            "List glass, frames and sills when agreeing the work. Ask which accessible sides are covered. Mention insect screens, blinds and unusual fittings separately.",
            "A glazed balcony is not automatically one large window. It may involve glass, floors and other surfaces. The balcony is a separate option in the estimate, so clarify both parts."
          ],
          bullets: [
            "A full photograph of each window type.",
            "Approximate width and height.",
            "Opening and fixed sections.",
            "Screens, blinds and adjoining balcony doors."
          ]
        },
        {
          id: "access",
          title: "Show how the windows can be reached",
          paragraphs: [
            "Clear plants and small objects from the sill. Mention heavy furniture blocking access or a sash that will not open. Do not assume heavy items can be moved without agreement.",
            "Inaccessible external glass is not routine work simply because it belongs to an apartment. LumaClean does not offer façade work. Do not lean out of a window to reach its outer surface."
          ],
          tip: "Photograph the whole window from inside the room, not just a close-up of a mark. This shows both size and access."
        },
        {
          id: "booking",
          title: "Include windows with the main cleaning request",
          paragraphs: [
            "Windows are selected as an extra alongside the main service on the website. If you only need windows, check availability first; the calculator option does not promise a standalone visit.",
            "Send the apartment area, service choice, window list and photographs. Show paint, construction residue or damaged glass in advance. Routine washing does not mean every mark can be removed from every surface."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/windows.webp"
};
