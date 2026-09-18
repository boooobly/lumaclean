import type {Locale} from "@/i18n/routing";

export const businessContact = {
  telephone: "+381653470308",
  displayTelephone: "+381 65 347 0308",
  opens: "09:00",
  closes: "22:00",
  timeZone: "Europe/Belgrade",
  days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
} as const;

export const businessContactCopy = {
  ru: {title: "Связаться с LumaClean", area: "Выездная уборка по всему Белграду", hours: "Заявки принимаем ежедневно, 09:00–22:00 по времени Белграда.", languages: "По телефону — русский и английский. По-сербски — переписка в Viber.", call: "Позвонить", viber: "Написать в Viber"},
  sr: {title: "Kontaktirajte LumaClean", area: "Dolazimo na vašu adresu širom Beograda", hours: "Upite primamo svakog dana, 09:00–22:00 po beogradskom vremenu.", languages: "Telefonom razgovaramo na ruskom i engleskom. Na srpskom nam pišite preko Vibera.", call: "Pozovite nas", viber: "Pišite preko Vibera"},
  en: {title: "Contact LumaClean", area: "Cleaning at your address across Belgrade", hours: "We take enquiries every day, 09:00–22:00 Belgrade time.", languages: "Phone calls in Russian and English. For Serbian, please message us on Viber.", call: "Call us", viber: "Message on Viber"},
} satisfies Record<Locale, {title: string; area: string; hours: string; languages: string; call: string; viber: string}>;

export const googleBusinessProfile = {
  url: "https://maps.app.goo.gl/u8RBLQWzo7ocCssw7",
  reviewUrl: "https://g.page/r/CVrDJ1HHTF49EBM/review",
} as const;

const whatsappMessage: Record<Locale, string> = {
  ru: "Здравствуйте! Хочу узнать стоимость уборки.",
  sr: "Zdravo! Želim da saznam cenu čišćenja.",
  en: "Hello! I would like to get a cleaning estimate.",
};

export function getMessengerLinks(locale: Locale) {
  return [
    {id: "telegram", label: "Telegram", value: "@luma_clean", href: "https://t.me/luma_clean"},
    {id: "viber", label: "Viber", value: "+381 65 347 0308", href: "viber://chat?number=%2B381653470308"},
    {id: "whatsapp", label: "WhatsApp", value: "+7 988 701-30-06", href: `https://wa.me/79887013006?text=${encodeURIComponent(whatsappMessage[locale])}`},
  ] as const;
}
