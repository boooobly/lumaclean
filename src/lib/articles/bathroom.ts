import type {Article} from "./types";

export const bathroom: Article = {
  id: "bathroom",
  services: [
    "deep"
  ],
  relatedIds: [
    "regular-deep",
    "kitchen",
    "choose"
  ],
  translations: {
    ru: {
      slug: "nalyot-v-vannoy-chto-mozhno-otmyt",
      title: "Налёт в ванной: что можно отмыть, а что лучше сначала показать",
      description: "Как описать налёт и следы воды в ванной перед уборкой: стекло, плитка, смеситель и покрытия. Что сфотографировать и почему не стоит тереть сильнее.",
      category: "Ванная",
      imageAlt: "Иллюстрация светлой ванной с металлическим краном и бирюзовым полотенцем",
      lead: "На стекле остались белые следы, а смеситель потерял блеск. Хочется взять средство посильнее, но по внешнему виду не всегда ясно, где налёт, а где уже изменилось покрытие. Перед уборкой полезнее разобраться с материалом и историей пятна.",
      sections: [
        {
          id: "look",
          title: "Опишите, что изменилось",
          paragraphs: [
            "Вспомните, когда появились следы: постепенно после душа или сразу после какого-то средства. Посмотрите, есть ли потёртости, сколы или участки, отличающиеся по цвету. Не нужно самостоятельно определять состав загрязнения — достаточно точно описать наблюдения.",
            "Налёт находится на поверхности, а повреждение может затрагивать сам материал или защитный слой. Поэтому одинаково выглядящие пятна не обязательно убираются одним способом. Обещать результат по слову «белое» было бы нечестно."
          ]
        },
        {
          id: "material",
          title: "Уточните материал, прежде чем выбирать средство",
          paragraphs: [
            "Стекло, керамика, натуральный камень и декоративное покрытие смесителя имеют разные требования к уходу. Если вы знаете марку или сохранили инструкцию, передайте её. Особенно это полезно для матовой, окрашенной и необычной металлической отделки.",
            "Не проверяйте несколько сильных средств подряд на видном участке и не смешивайте их. Для самостоятельного ухода придерживайтесь инструкции конкретного изделия и выбранного средства. Если совместимость непонятна, сначала уточните её у производителя, а не усиливайте трение."
          ]
        },
        {
          id: "photos",
          title: "Сделайте три понятных фотографии",
          paragraphs: [
            "Команде нужен не только крупный план пятна. Общий вид показывает размер зоны, а боковой свет иногда помогает увидеть поверхность без блика. Не применяйте фильтры и не фотографируйте через слой пены."
          ],
          bullets: [
            "Вся душевая, ванна или раковина.",
            "Проблемное место крупно при обычном освещении.",
            "Марка или обозначение материала, если оно доступно."
          ],
          tip: "Сообщите, чем уже пытались чистить поверхность и что после этого изменилось. Это важнее оценки «очень сильный налёт»."
        },
        {
          id: "scope",
          title: "Согласуйте результат без обещания нового покрытия",
          paragraphs: [
            "В LumaClean можно обсудить генеральную уборку ванной в составе выбранного формата. Стойкие следы покажите заранее, чтобы согласовать работу и её ограничения. Восстановление повреждённого покрытия, ремонт, устранение плесени и последствий затопления не относятся к обычной уборке.",
            "После визита поддерживайте поверхность по рекомендациям производителя. Где это допускается, удаление оставшейся воды помогает не оставлять её высыхать на стекле и сантехнике. Если пятно остаётся неизменным после подходящего ухода, лучше повторно оценить материал, чем обещать, что ещё одно средство обязательно решит проблему."
          ]
        }
      ]
    },
    sr: {
      slug: "naslage-u-kupatilu-sta-moze-da-se-ocisti",
      title: "Naslage u kupatilu: šta može da se očisti, a šta prvo treba pogledati",
      description: "Kako opisati bele tragove i naslage na staklu, pločicama i slavinama. Fotografije, materijali i granice čišćenja pre dogovora o poslu.",
      category: "Kupatilo",
      imageAlt: "Ilustracija svetlog kupatila sa metalnom slavinom i tirkiznim peškirom",
      lead: "Na staklu su beli tragovi, a slavina više nema isti sjaj. Jače sredstvo deluje kao brz odgovor, ali nije uvek jasno da li je u pitanju naslaga ili promena završnog sloja. Prvo proverite materijal i kako je trag nastao.",
      sections: [
        {
          id: "look",
          title: "Opišite promenu",
          paragraphs: [
            "Setite se da li su tragovi nastajali postepeno posle tuširanja ili odmah posle nekog sredstva. Pogledajte ima li ogrebotina, okrnjenih mesta ili promene boje. Ne morate sami odrediti sastav naslage; dovoljno je tačno opisati šta vidite.",
            "Naslaga je na površini, dok oštećenje može zahvatiti materijal ili zaštitni sloj. Slični tragovi zato ne moraju reagovati na isti postupak. Sam opis „belo” nije osnova za obećanje rezultata."
          ]
        },
        {
          id: "material",
          title: "Proverite materijal",
          paragraphs: [
            "Staklo, keramika, prirodni kamen i dekorativni sloj slavine imaju različita pravila nege. Ako znate marku ili imate uputstvo, prosledite ga, naročito za mat, obojene i posebne metalne završne slojeve.",
            "Ne isprobavajte više jakih sredstava jedno za drugim na vidljivom mestu i ne mešajte ih. Za samostalno održavanje pratite uputstva proizvoda i površine. Ako kompatibilnost nije jasna, proverite kod proizvođača umesto jačeg ribanja."
          ]
        },
        {
          id: "photos",
          title: "Pošaljite korisne fotografije",
          paragraphs: [
            "Tim treba da vidi i veličinu zone, ne samo detalj. Bočno svetlo može pomoći da se površina vidi bez odsjaja. Izbegnite filtere i fotografisanje kroz penu."
          ],
          bullets: [
            "Cela tuš-kabina, kada ili lavabo.",
            "Detalj problematičnog mesta.",
            "Oznaka materijala ili proizvođača, ako je dostupna."
          ],
          tip: "Napišite šta ste već koristili i da li se izgled posle toga promenio."
        },
        {
          id: "scope",
          title: "Dogovorite posao i njegova ograničenja",
          paragraphs: [
            "Sa LumaClean-om možete razgovarati o temeljnijem čišćenju kupatila u izabranom formatu. Upornije tragove pokažite unapred. Obnova oštećenog sloja, popravke, uklanjanje buđi i posledica poplave nisu uobičajeno čišćenje.",
            "Posle dolaska održavajte površinu prema uputstvu proizvođača. Gde je dozvoljeno, uklanjanje zaostale vode sprečava da se ona suši na staklu i sanitarijama. Ako trag ostaje posle odgovarajuće nege, ponovo procenite materijal umesto da očekujete da će sledeće sredstvo sigurno pomoći."
          ]
        }
      ]
    },
    en: {
      slug: "bathroom-deposits-and-surface-damage",
      title: "Bathroom deposits: what can be cleaned and what needs a closer look",
      description: "Describe water marks and deposits on bathroom glass, tiles and taps before cleaning. Useful photographs, material care and realistic limits.",
      category: "Bathroom",
      imageAlt: "Illustration of a pale bathroom with a metal tap and teal hand towel",
      lead: "There are white marks on the glass and the tap has lost its shine. A stronger product may seem like the answer, but the mark could be a deposit or a change to the finish itself. Start with the material and the history of the patch.",
      sections: [
        {
          id: "look",
          title: "Describe what changed",
          paragraphs: [
            "Recall whether the marks appeared gradually after showers or immediately after using a product. Look for scratches, chips or changes in colour. You need not diagnose the substance; a clear description is enough.",
            "A deposit sits on the surface, while damage may affect the material or protective finish. Similar-looking marks may therefore need different treatment. The word “white” alone is not a basis for promising removal."
          ]
        },
        {
          id: "material",
          title: "Check the material first",
          paragraphs: [
            "Glass, ceramic, natural stone and decorative tap finishes can have different care requirements. Share the brand or instructions if available, especially for matt, coloured or unusual metal finishes.",
            "Do not try a succession of strong products on a visible area or mix them together. For home care, follow both the surface and product instructions. If compatibility is unclear, ask the manufacturer rather than scrubbing harder."
          ]
        },
        {
          id: "photos",
          title: "Take useful photographs",
          paragraphs: [
            "The team needs to see the size of the area as well as a close-up. Side lighting can help show the surface without glare. Avoid filters or photographing through foam."
          ],
          bullets: [
            "The whole shower enclosure, bath or basin.",
            "A clear detail of the affected area.",
            "Material or manufacturer information, if available."
          ],
          tip: "Explain what you have already used and whether the appearance changed afterwards."
        },
        {
          id: "scope",
          title: "Agree the work and its limits",
          paragraphs: [
            "Discuss more thorough bathroom cleaning with LumaClean as part of the selected service. Show persistent marks beforehand so the work and limitations can be agreed. Restoring damaged finishes, repairs, mould removal and flood recovery are outside ordinary cleaning.",
            "Afterwards, follow the manufacturer's care guidance. Where permitted, removing remaining water avoids leaving it to dry on glass and fittings. If a mark remains after appropriate care, reassess the material rather than assuming another product must fix it."
          ]
        }
      ]
    }
  },
  status: "published",
  publishedAt: "2026-09-15",
  updatedAt: "2026-09-15",
  image: "/media/articles/bathroom.webp"
};
