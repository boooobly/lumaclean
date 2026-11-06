import 'server-only';
import {siteContent} from './content';
import type {Locale} from '@/i18n/routing';

export type ChatRecapCopy = Record<Locale, {
  service: string;
  extras: string;
  labels: Record<string, string>;
  services: {id: string; name: string}[];
}>;

// A conversation can change language. Keep its three small recap dictionaries,
// while leaving the rest of the marketing content outside the client bundle.
export const chatRecapCopy: ChatRecapCopy = Object.fromEntries(
  Object.entries(siteContent).map(([locale, content]) => [locale, {
    service: content.calculator.service,
    extras: content.calculator.extras,
    labels: content.calculator.labels,
    services: content.services.map(({id, name}) => ({id, name})),
  }]),
) as ChatRecapCopy;
