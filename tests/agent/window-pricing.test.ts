import test from 'node:test';
import assert from 'node:assert/strict';
import { extrasPrices, formatRsd } from '../../src/lib/pricing';
import { siteContent } from '../../src/lib/content';
import { serviceSeoContent } from '../../src/lib/seo-services';
import { businessKnowledge, knowledgeConsistency } from '../../src/lib/agent/knowledge/search';

test('window knowledge preserves units, included scope and booking restrictions', () => {
  assert.deepEqual(knowledgeConsistency(), { ok: true, errors: [] });
  for (const [code, runtimeCode, amount, autoBook] of [
    ['ADD-WINDOW-001', 'standardWindow', 700, true],
    ['ADD-WINDOW-002', 'largeWindow', 1000, false],
  ] as const) {
    const entry = businessKnowledge.entries.find(e => e.code === code)!;
    assert.equal(entry.runtimeCode, runtimeCode);
    assert.equal(entry.price?.amount, amount);
    assert.equal(entry.price?.unit, 'окно');
    assert.equal(entry.autoBook, autoBook);
    assert.match(entry.restrictions, /обе стороны, рамы\/пазы\/подоконник включены/u);
  }
});

for (const locale of ['ru', 'sr', 'en'] as const) test(`${locale} public window FAQs use the shared catalogue`, () => {
  const home = siteContent[locale].faq.items[3].a;
  const service = serviceSeoContent[locale].regular.faq.find(item => /окон|prozor|windows/iu.test(item.q))!.a;
  for (const text of [home, service]) {
    assert(text.includes(formatRsd(extrasPrices.standardWindow, locale)), text);
    assert(text.includes(formatRsd(extrasPrices.largeWindow, locale)), text);
    assert(!/1[ ,.]500/u.test(text));
  }
});
