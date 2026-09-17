import type {Locale} from "@/i18n/routing";
import {googleBusinessProfile} from "@/lib/contacts";
import styles from "./google-profile-links.module.css";

const copy = {
  ru: {profile: "LumaClean в Google Картах", review: "Оставить отзыв в Google"},
  sr: {profile: "LumaClean na Google mapama", review: "Ostavite recenziju na Google-u"},
  en: {profile: "LumaClean on Google Maps", review: "Leave a Google review"},
} satisfies Record<Locale, {profile: string; review: string}>;

export function GoogleProfileLinks({locale}: {locale: Locale}) {
  return <div className={styles.links}>
    <a href={googleBusinessProfile.url}>{copy[locale].profile} ↗</a>
    <a href={googleBusinessProfile.reviewUrl}>{copy[locale].review} ↗</a>
  </div>;
}
