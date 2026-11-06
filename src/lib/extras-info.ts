import type {Locale} from '@/i18n/routing';
import type {extrasPrices} from './pricing';

// Informational scope only. Names, order and prices stay with the existing ledger.
export const extrasInfo = {
  standardWindow: {
    image:'/media/extras/standard-window.webp',
    description:{
      ru:'Моем стекло с обеих сторон, протираем доступные рамы, пазы и подоконник.',
      sr:'Peremo staklo sa obe strane i brišemo dostupne okvire, žlebove i prozorsku dasku.',
      en:'We wash both sides of the glass and wipe accessible frames, grooves and the sill.',
    },
  },
  largeWindow: {
    image:'/media/extras/large-window.webp',
    description:{
      ru:'Моем крупные стёкла с обеих сторон, очищаем доступные рамы и подоконник.',
      sr:'Peremo velika stakla sa obe strane i čistimo dostupne okvire i prozorsku dasku.',
      en:'We wash both sides of large panes and clean the accessible frames and window sill.',
    },
  },
  balcony: {
    image:'/media/extras/balcony.webp',
    description:{
      ru:'Убираем доступные поверхности и моем пол на балконе или террасе в согласованном объёме.',
      sr:'Čistimo dostupne površine i peremo pod balkona ili terase u dogovorenom obimu.',
      en:'We clean accessible surfaces and wash the balcony or terrace floor within the agreed scope.',
    },
  },
  fridge: {
    image:'/media/extras/fridge.webp',
    description:{
      ru:'Протираем доступные полки и внутренние поверхности холодильника без разборки техники.',
      sr:'Brišemo dostupne police i unutrašnje površine frižidera, bez demontaže uređaja.',
      en:'We wipe accessible shelves and interior surfaces of the fridge without taking it apart.',
    },
  },
  oven: {
    image:'/media/extras/oven.webp',
    description:{
      ru:'Очищаем доступные внутренние поверхности остывшей духовки от бытовых загрязнений.',
      sr:'Čistimo dostupne unutrašnje površine ohlađene rerne od uobičajenih naslaga.',
      en:'We clean ordinary household residue from accessible interior surfaces of the cooled oven.',
    },
  },
  microwave: {
    image:'/media/extras/microwave.webp',
    description:{
      ru:'Удаляем следы еды с доступных внутренних поверхностей микроволновки и протираем поддон.',
      sr:'Uklanjamo ostatke hrane sa dostupnih unutrašnjih površina mikrotalasne i brišemo tanjir.',
      en:'We remove food residue from accessible microwave interiors and wipe the glass turntable.',
    },
  },
  hood: {
    image:'/media/extras/hood.webp',
    description:{
      ru:'Очищаем доступные внутренние поверхности кухонной вытяжки без демонтажа и ремонта.',
      sr:'Čistimo dostupne unutrašnje površine kuhinjskog aspiratora, bez demontaže i popravki.',
      en:'We clean accessible interior surfaces of the kitchen hood without dismantling or repairs.',
    },
  },
  dishwasher: {
    image:'/media/extras/dishwasher.webp',
    description:{
      ru:'Протираем доступные внутренние поверхности и дверцу посудомоечной машины без разборки.',
      sr:'Brišemo dostupne unutrašnje površine i vrata mašine za sudove, bez demontaže uređaja.',
      en:'We wipe accessible interior surfaces and the dishwasher door without taking it apart.',
    },
  },
  washingMachine: {
    image:'/media/extras/washing-machine.webp',
    description:{
      ru:'Протираем доступные поверхности барабана, дверцы и уплотнителя стиральной машины.',
      sr:'Brišemo dostupne površine bubnja, vrata i zaptivne gume mašine za pranje veša.',
      en:'We wipe the accessible surfaces of the washing machine drum, door and rubber seal.',
    },
  },
  cabinets: {
    image:'/media/extras/cabinets.webp',
    description:{
      ru:'Протираем доступные полки и стенки пустой секции шкафа; вещи убирают заранее.',
      sr:'Brišemo dostupne police i zidove praznog dela ormarića; stvari se uklanjaju unapred.',
      en:'We wipe accessible shelves and walls of an empty cabinet section, cleared beforehand.',
    },
  },
  ironing: {
    image:'/media/extras/ironing.webp',
    description:{
      ru:'Гладим подготовленную одежду и домашний текстиль; цена указана за 30 минут работы.',
      sr:'Peglamo pripremljenu odeću i kućni tekstil; navedena cena je za 30 minuta rada.',
      en:'We iron prepared clothing and household linen; the listed price covers 30 minutes of work.',
    },
  },
  steam: {
    image:'/media/extras/steam.webp',
    description:{
      ru:'Обрабатываем паром только подходящие для этого поверхности; объём согласуем до уборки.',
      sr:'Parom obrađujemo samo površine koje su za to pogodne; obim dogovaramo pre čišćenja.',
      en:'We steam-clean suitable surfaces only, agreeing the scope of the work before cleaning.',
    },
  },
  petHair: {
    image:'/media/extras/pet-hair.webp',
    description:{
      ru:'Дополнительно собираем шерсть животных с доступных поверхностей и текстильной обивки.',
      sr:'Dodatno uklanjamo dlake kućnih ljubimaca sa dostupnih površina i tekstilnih presvlaka.',
      en:'We remove additional pet hair from accessible surfaces and fabric-covered furniture.',
    },
  },
  linen: {
    image:'/media/extras/linen.webp',
    description:{
      ru:'Снимаем использованное бельё и застилаем кровать подготовленным чистым комплектом.',
      sr:'Skidamo korišćenu posteljinu i nameštamo krevet pripremljenim čistim kompletom.',
      en:'We remove the used bed linen and make the bed with a clean set prepared beforehand.',
    },
  },
} satisfies Record<keyof typeof extrasPrices,{image:string;description:Record<Locale,string>}>;

export const extrasInfoUi = {
  ru:{hint:'Выберите услугу, чтобы посмотреть состав работ.',close:'Закрыть описание'},
  sr:{hint:'Izaberite uslugu da pogledate šta obuhvata.',close:'Zatvori opis'},
  en:{hint:'Choose a service to see what the work includes.',close:'Close description'},
} satisfies Record<Locale,{hint:string;close:string}>;
