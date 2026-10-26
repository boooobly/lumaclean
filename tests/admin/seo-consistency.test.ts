import assert from 'node:assert/strict';
import test from 'node:test';
import {createTranslator} from 'use-intl/core';
import ru from '../../messages/ru.json';
import sr from '../../messages/sr.json';
import en from '../../messages/en.json';
import {formatRsd, priceMatrix} from '../../src/lib/pricing';
import {serviceSeoContent} from '../../src/lib/seo-services';
import {legacyServiceRedirects} from '../../src/lib/legacy-service-redirects';

for (const [locale, messages] of Object.entries({ru, sr, en})) {
  test(`${locale}: homepage metadata uses the approved cleaning minimum, not the upholstery visit floor`, () => {
    const t = createTranslator({locale, messages, namespace: 'Metadata'});
    const description = t('description', {price: formatRsd(priceMatrix.regular[0], locale)});
    assert.ok(description.includes(formatRsd(4900, locale)), description);
    assert.ok(!description.includes(formatRsd(4000, locale)), description);
  });
}

test('numeric price guides in service metadata match their approved minimums', () => {
  for (const locale of ['ru', 'sr', 'en'] as const) {
    for (const service of ['regular', 'deep', 'move', 'airbnb', 'office'] as const) {
      const content = serviceSeoContent[locale][service];
      // Pages can omit prices in metadata. Validate every guide they do advertise.
      for (const text of [content.title, content.description].filter(text => /\d/.test(text))) {
        assert.ok(text.replace(/[.,\s\u00a0]/g, '').includes(String(priceMatrix[service][0])), text);
      }
    }
  }
});

test('the seven historical GSC 404s redirect directly to published service equivalents', () => {
  const paths = new Set(Object.entries(serviceSeoContent).flatMap(([locale,services]) => Object.values(services).map(service => `/${locale}/services/${service.slug}`)));
  assert.equal(legacyServiceRedirects.length,7);
  assert.equal(new Set(legacyServiceRedirects.map(r=>r.source)).size,7);
  for(const rule of legacyServiceRedirects) {
    assert(paths.has(rule.destination),rule.destination);
    assert.equal(rule.permanent,true);
    assert(!legacyServiceRedirects.some(r=>r.source===rule.destination),'No redirect chain');
  }
});
