import type {Locale} from '@/i18n/routing';
export const requestKinds=['CLEANING','CLEANING_UPHOLSTERY','UPHOLSTERY','CONTACT_REQUEST'] as const;
export type RequestKind=typeof requestKinds[number];
export function leadRequestKind(lead:{requestKind?:string;upholsteryRequested?:boolean;upholsteryQuote?:unknown;area?:unknown}):RequestKind {
  if(lead.requestKind==='CONTACT_REQUEST')return 'CONTACT_REQUEST';
  const mode=(lead.upholsteryQuote as {input?:{mode?:string}}|null)?.input?.mode;
  if(lead.requestKind==='UPHOLSTERY'||mode==='STANDALONE')return 'UPHOLSTERY';
  if(lead.requestKind==='CLEANING_UPHOLSTERY')return 'CLEANING_UPHOLSTERY';
  if(lead.upholsteryRequested||lead.upholsteryQuote)return 'CLEANING_UPHOLSTERY';
  return 'CLEANING';
}
export const requestKindLabels={CLEANING:'Уборка',CLEANING_UPHOLSTERY:'Уборка + химчистка',UPHOLSTERY:'Только химчистка',CONTACT_REQUEST:'Обратный звонок'};
export const upholsteryEnquiryPath=(locale:Locale)=>`/${locale}?request=upholstery#estimate`;
export const enquiryCopy={
 ru:{kind:'Что вам нужно?',cleaning:'Уборка квартиры',only:'Только химчистка',checkbox:'Нужна химчистка мебели или ковров',hint:'Менеджер уточнит детали и рассчитает стоимость химчистки отдельно.',cleaningPrice:'Стоимость уборки без химчистки',pending:'Химчистка: стоимость уточнит менеджер.',agreed:'Окончательная сумма будет согласована до выезда.',onlyPrice:'Стоимость химчистки рассчитаем после уточнения деталей.',send:'Отправить заявку',placeholder:'Например: нужна химчистка дивана и ковра',success:'Спасибо! Заявку получили. Менеджер уточнит детали химчистки и согласует стоимость.',cta:'Оставить заявку на химчистку',articleCta:'Узнать стоимость химчистки',otherItems:'Матрасы и ковры: возможность обработки и стоимость уточним лично, с учётом материала и состояния.'},
 sr:{kind:'Šta vam je potrebno?',cleaning:'Čišćenje stana',only:'Samo dubinsko pranje',checkbox:'Potrebno je i dubinsko pranje nameštaja ili tepiha',hint:'Menadžer će proveriti detalje i posebno potvrditi cenu dubinskog pranja.',cleaningPrice:'Cena čišćenja bez dubinskog pranja',pending:'Dubinsko pranje: cenu će potvrditi menadžer.',agreed:'Konačna cena biće dogovorena pre dolaska.',onlyPrice:'Cenu dubinskog pranja potvrdićemo nakon razgovora o detaljima.',send:'Pošaljite upit',placeholder:'Na primer: potrebno je pranje kauča i tepiha',success:'Hvala! Primili smo upit. Menadžer će proveriti detalje dubinskog pranja i dogovoriti cenu.',cta:'Pošaljite upit za dubinsko pranje',articleCta:'Saznajte cenu dubinskog pranja',otherItems:'Dušeci i tepisi: mogućnost pranja i cenu proveravamo u razgovoru, prema materijalu i stanju.'},
 en:{kind:'What do you need?',cleaning:'Home cleaning',only:'Upholstery cleaning only',checkbox:'I also need upholstery or carpet cleaning',hint:'Our team will confirm the details and price separately.',cleaningPrice:'Cleaning price excluding upholstery',pending:'Upholstery cleaning: our team will confirm the price.',agreed:'The final amount will be agreed before the visit.',onlyPrice:'We will calculate the upholstery cleaning price after discussing the details.',send:'Send enquiry',placeholder:'For example: I need sofa and carpet cleaning',success:'Thank you! We received your enquiry. Our team will discuss the upholstery cleaning details and confirm the price.',cta:'Request upholstery cleaning',articleCta:'Get an upholstery cleaning quote',otherItems:'Mattresses and carpets: we will discuss treatment suitability and pricing based on their material and condition.'},
} as const;
