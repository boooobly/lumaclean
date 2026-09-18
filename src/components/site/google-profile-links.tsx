import type {Locale} from "@/i18n/routing";
import {businessContact, businessContactCopy, getMessengerLinks, googleBusinessProfile} from "@/lib/contacts";
import styles from "./google-profile-links.module.css";

const copy = {
  ru: {profile: "LumaClean в Google Картах", review: "Оставить отзыв в Google"},
  sr: {profile: "LumaClean na Google mapama", review: "Ostavite recenziju na Google-u"},
  en: {profile: "LumaClean on Google Maps", review: "Leave a Google review"},
} satisfies Record<Locale, {profile: string; review: string}>;

export function GoogleProfileLinks({locale}: {locale: Locale}) {
  const contact = businessContactCopy[locale];
  return <div className={styles.contact}>
    <section className={styles.details} aria-label={contact.title}>
      <div><h2>{contact.title}</h2><p>{contact.area}</p></div>
      <div><p>{contact.hours}</p><p>{contact.languages}</p></div>
      <div className={styles.actions}>
        <a href={`tel:${businessContact.telephone}`}><span>{contact.call}</span><strong>{businessContact.displayTelephone}</strong></a>
        <a href={getMessengerLinks(locale)[1].href}>{contact.viber} ↗</a>
      </div>
    </section>
    <div className={styles.links}>
      <a href={googleBusinessProfile.url}>{copy[locale].profile} ↗</a>
      <a href={googleBusinessProfile.reviewUrl}>{copy[locale].review} ↗</a>
    </div>
  </div>;
}
