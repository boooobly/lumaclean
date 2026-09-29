import type {Locale} from "@/i18n/routing";

// Curated tasks, not keyword-only pages. Every published guide has a place.
export const readingPaths = [
  {ids: ["choose", "regular-deep", "cost"], copy: {
    ru: {title: "Выбрать уборку и понять цену", text: "С чего начать первый заказ: сравнить форматы, проверить состав работ и посчитать бюджет."},
    sr: {title: "Izaberite uslugu i proverite cenu", text: "Za prvi upit: uporedite vrste čišćenja, proverite obim posla i procenite troškove."},
    en: {title: "Choose a service and understand the price", text: "Start here for a first booking: compare services, agree the task list and estimate the cost."},
  }},
  {ids: ["move-in", "move-out", "prepare"], copy: {
    ru: {title: "Подготовиться к переезду", text: "До въезда или передачи ключей: что проверить, что освободить и как подготовить квартиру к приезду команды."},
    sr: {title: "Pripremite se za selidbu", text: "Pre useljenja ili predaje ključeva: šta proveriti i kako pripremiti stan za dolazak tima."},
    en: {title: "Get ready for a move", text: "Before moving in or handing back the keys: what to check and how to prepare for the cleaning team."},
  }},
  {ids: ["frequency", "kitchen", "bathroom", "windows", "pet-hair"], copy: {
    ru: {title: "Поддерживать порядок дома", text: "График уборки, кухня, ванная, окна и шерсть: как выбрать задачи и избежать лишних ожиданий."},
    sr: {title: "Održavajte dom između čišćenja", text: "Raspored, kuhinja, kupatilo, prozori i dlake ljubimaca: odaberite poslove koji su vam potrebni."},
    en: {title: "Keep your home in order", text: "Cleaning schedules, kitchens, bathrooms, windows and pet hair: choose the tasks that matter to you."},
  }},
  {ids: ["airbnb", "office", "duration"], copy: {
    ru: {title: "Спланировать уборку под расписание", text: "Смена гостей, небольшой офис и время визита: как согласовать доступ и приоритеты заранее."},
    sr: {title: "Uklopite čišćenje u raspored", text: "Smena gostiju, mala kancelarija i trajanje posete: dogovorite pristup i prioritete unapred."},
    en: {title: "Plan around your schedule", text: "Guest turnovers, small offices and visit duration: agree access and priorities before the team arrives."},
  }},
] satisfies {ids: string[]; copy: Record<Locale, {title: string; text: string}>}[];

export const readingPathsUi: Record<Locale, {title: string; all: string}> = {
  ru: {title: "Что вы хотите решить?", all: "Все материалы"},
  sr: {title: "Šta želite da rešite?", all: "Svi vodiči"},
  en: {title: "What do you need help with?", all: "All guides"},
};
