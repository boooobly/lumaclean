/* eslint-disable @typescript-eslint/no-require-imports -- Standalone pricing regression check. */
// Run: node docs/check-pricing.cjs [http://localhost:3100 | https://lumacleanrs.com]
// Reads pages only; never submits an enquiry or changes an external service.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {exports, require: id => {
    assert.ok(id in mocks, `Unexpected runtime import: ${id}`);
    return mocks[id];
  }, Intl}, {filename: file});
  return exports;
}
const plain = value => JSON.parse(JSON.stringify(value));
const pricing = load('src/lib/pricing.ts');
const content = load('src/lib/content.ts', {'./pricing': pricing}).siteContent;
const planning = load('src/lib/service-planning.ts', {'@/lib/pricing': pricing}).servicePlanningUi;
const seo = load('src/lib/seo-services.ts');
const expectedMatrix = {
  regular: [4000, 4600, 5700, 7200, 85], deep: [9300, 10700, 12900, 14900, 180],
  move: [10200, 11700, 14300, 16400, 200], airbnb: [4000, 4500, 5500, 6900, 80],
  office: [4000, 4700, 5900, 7200, 75],
};
assert.deepEqual(plain(pricing.priceMatrix), expectedMatrix, 'Tariff amounts must not change');
assert.deepEqual(plain(pricing.extrasPrices), {
  standardWindow: 900, largeWindow: 1200, balcony: 1100, fridge: 900, oven: 1100,
  cabinets: 900, ironing: 900, steam: 2800, linen: 750, petHair: 900,
}, 'Extras must not change');
const expectedLabels = {
  ru: ['До 39 м²', '40–59 м²', '60–79 м²', '80–99 м²', 'От 100 м²'],
  sr: ['Do 39 m²', '40–59 m²', '60–79 m²', '80–99 m²', 'Od 100 m²'],
  en: ['Up to 39 m²', '40–59 m²', '60–79 m²', '80–99 m²', '100 m² and up'],
};
assert.deepEqual(plain(pricing.priceAreaLabels), expectedLabels);
for (const locale of ['ru', 'sr', 'en']) {
  assert.deepEqual(plain(content[locale].pricing.area), expectedLabels[locale]);
  assert.deepEqual(plain(planning[locale].ranges), expectedLabels[locale]);
}
const areas = [...Array.from({length: 156}, (_, i) => i + 25), 39.99, 59.99, 79.99, 99.99];
for (const [service, row] of Object.entries(expectedMatrix)) {
  for (const area of areas) {
    const expected = area < 40 ? row[0] : area < 60 ? row[1] : area < 80 ? row[2] : area < 100 ? row[3] : Math.max(4000, Math.round(area * row[4] / 100) * 100);
    assert.equal(pricing.basePrice(service, area), expected, `${service}, ${area} m²`);
  }
}
const oldBands = /41\s*[–-]\s*60|61\s*[–-]\s*80|81\s*[–-]\s*99|(?:до|do|up to)\s+40\s*[мm]²/i;
assert.doesNotMatch(JSON.stringify(seo.serviceSeoContent), oldBands);
console.log('PASS: unchanged prices/extras, 800 area/service cases, shared labels in three languages and FAQ.');

async function checkPages(origin) {
  const paths = ['ru', 'sr', 'en'].flatMap(locale => [
    {locale, path: `/${locale}`},
    ...pricing.serviceIds.map(service => ({locale, path: seo.getServicePath(locale, service)})),
  ]);
  await Promise.all(paths.map(async ({locale, path}) => {
    const response = await fetch(new URL(path, origin));
    assert.equal(response.status, 200, path);
    const html = await response.text();
    for (const label of expectedLabels[locale]) assert.ok(html.includes(label), `${path}: missing ${label}`);
    assert.doesNotMatch(html, oldBands, `${path}: obsolete range`);
    assert.doesNotMatch(html, /<meta[^>]+name="robots"[^>]+noindex/i, path);
  }));
  const sitemap = await (await fetch(new URL('/sitemap.xml', origin))).text();
  assert.equal((sitemap.match(/<loc>/g) || []).length, 63);
  assert.equal((sitemap.match(/<lastmod>2026-09-28T00:00:00\.000Z<\/lastmod>/g) || []).length, 18);
  console.log('PASS: all 18 public price pages, no old bands/noindex, 63 sitemap URLs and 18 maintained pricing dates.');
}
if (process.argv[2]) checkPages(process.argv[2]).catch(error => {console.error(error); process.exitCode = 1;});
