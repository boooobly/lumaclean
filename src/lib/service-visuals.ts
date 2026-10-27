import type {Locale} from '@/i18n/routing';
import type {ServiceId} from '@/lib/pricing';

type LocalizedAlt = Record<Locale, string>;
type ServiceVisual = {hero: string; heroAlt: LocalizedAlt; scope: string; scopeAlt: LocalizedAlt};

/** Presentation only: commercial content, SEO images and tariffs stay in their existing sources. */
export const serviceVisuals: Record<ServiceId, ServiceVisual> = {
  regular: {
    hero: '/media/services/regular.webp',
    heroAlt: {ru:'Протирание кухонной столешницы в светлой квартире', sr:'Brisanje kuhinjske radne ploče u svetlom stanu', en:'Wiping a kitchen worktop in a bright apartment'},
    scope: '/media/kitchen-clean.webp',
    scopeAlt: {ru:'Чистые рабочие поверхности современной кухни', sr:'Čiste radne površine savremene kuhinje', en:'Clean work surfaces in a modern kitchen'},
  },
  deep: {
    hero: '/media/services/deep.webp',
    heroAlt: {ru:'Детальная очистка плинтуса рядом с кухонными шкафами', sr:'Detaljno brisanje lajsne pored kuhinjskih elemenata', en:'Detailed cleaning of a skirting board beside kitchen cabinets'},
    scope: '/media/material-chrome.webp',
    scopeAlt: {ru:'Хромированный смеситель и поверхность раковины крупным планом', sr:'Hromirana slavina i površina lavaboa izbliza', en:'A close view of a chrome tap and basin surface'},
  },
  move: {
    hero: '/media/services/move.webp',
    heroAlt: {ru:'Уборка пола в пустой квартире перед заселением', sr:'Brisanje poda u praznom stanu pre useljenja', en:'Mopping the floor of an empty apartment before move-in'},
    scope: '/media/articles/move-in.webp',
    scopeAlt: {ru:'Светлое жилое пространство, подготовленное к заселению', sr:'Svetao stambeni prostor pripremljen za useljenje', en:'A bright living space prepared for move-in'},
  },
  airbnb: {
    hero: '/media/services/airbnb.webp',
    heroAlt: {ru:'Спальня апартамента с чистой постелью и сложенными полотенцами', sr:'Spavaća soba apartmana sa čistom posteljinom i složenim peškirima', en:'An apartment bedroom with fresh bed linen and folded towels'},
    scope: '/media/extras/linen.webp',
    scopeAlt: {ru:'Аккуратная укладка подготовленного постельного белья', sr:'Pažljivo nameštanje pripremljene čiste posteljine', en:'Carefully fitting prepared clean bed linen'},
  },
  office: {
    hero: '/media/services/office.webp',
    heroAlt: {ru:'Протирание стола в переговорной небольшого офиса', sr:'Brisanje stola u sali za sastanke manje kancelarije', en:'Wiping a meeting table in a small office'},
    scope: '/media/articles/office.webp',
    scopeAlt: {ru:'Аккуратные рабочие столы и кресла небольшого офиса', sr:'Uredni radni stolovi i stolice manje kancelarije', en:'Tidy desks and chairs in a small office'},
  },
};
