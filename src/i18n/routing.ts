import {defineRouting} from "next-intl/routing";

export const routing = defineRouting({
  locales: ["sr", "ru", "en"],
  defaultLocale: "ru",
  localePrefix: "always",
  localeDetection: true,
  // Localized service slugs are mapped in page metadata and sitemap.ts.
  // Automatic Link headers would reuse a slug across languages and link to 404s.
  alternateLinks: false,
});

export type Locale = (typeof routing.locales)[number];
