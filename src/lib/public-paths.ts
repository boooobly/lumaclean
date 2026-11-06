import {routing} from '@/i18n/routing';
import {articlePath, getPublishedArticles} from '@/lib/articles';
import {serviceIds} from '@/lib/pricing';
import {getServicePath} from '@/lib/seo-services';

// Public, published routes only. No query strings, admin URLs or customer values.
export const publicLeadPaths = routing.locales.flatMap(locale => [
  `/${locale}`,
  `/${locale}/articles`,
  ...[...serviceIds, 'upholstery' as const].map(service => getServicePath(locale, service)),
  ...getPublishedArticles().map(article => articlePath(article, locale)),
]);
