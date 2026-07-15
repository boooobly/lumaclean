import type {Locale} from "@/i18n/routing";

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
