// Read-only local navigation checks. APIs and analytics are intercepted before visiting pages.
import assert from 'node:assert/strict';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const base = process.env.BASE_URL || 'http://127.0.0.1:3137';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const seo = JSON.parse(await readFile('../outputs/seo-implementation-2026-10-26/seo-final.json', 'utf8'));
const article = seo.pages.find(p => p.path.startsWith('/ru/articles/'));
const articles = Object.fromEntries(['ru','sr','en'].map(locale => [locale, new URL(article.languages[locale]).pathname]));
const output = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/seo-2026-10-26/navigation');
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({reducedMotion: 'reduce'});
await context.addInitScript(() => localStorage.setItem('lc-analytics-consent-v2', 'no'));
await context.route('**/*', async route => {
  const r = route.request(), url = new URL(r.url());
  assert.ok(['GET','HEAD'].includes(r.method()), 'Write request blocked in navigation-only test');
  if (/google-analytics|googletagmanager|doubleclick/.test(url.hostname)) return route.fulfill({status: 204});
  if (url.pathname.startsWith('/api/')) return route.fulfill({contentType: 'application/json', body: JSON.stringify(url.pathname === '/api/chat' ? {conversation: null} : {allowed: false})});
  return route.continue();
});
const page = await context.newPage();
const report = {base, mocked: true, layout: [], switches: [], pageErrors: []};
page.on('pageerror', e => report.pageErrors.push(e.message));
async function go(route) {
  const response = await page.goto(base + route);
  assert.equal(response.status(), 200);
  await page.evaluate(() => document.fonts.ready);
}
try {
  for (const locale of ['ru','sr','en']) for (const route of [`/${locale}/articles`, articles[locale], `/${locale}/privacy-policy`, `/${locale}/data-deletion`]) {
    await go(route);
    assert.equal(await page.locator('html').getAttribute('lang'), locale);
    assert.equal(await page.locator('h1').count(), 1);
    for (const width of [375,768,1440]) {
      await page.setViewportSize({width, height: 1000});
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${route}/${width}`);
      report.layout.push({locale, route, width, height: 1000, status: 'PASS'});
    }
  }
  const homes = {ru: '/ru', sr: '/sr', en: '/en'};
  for (const routes of [homes, articles]) for (const from of ['ru','sr','en']) for (const to of ['ru','sr','en'].filter(x => x !== from)) {
    await go(routes[from]);
    if (routes === homes) await page.locator('form.estimate-sheet [name="phone"]').fill('+381601234567');
    await page.locator('.site-locales a').filter({hasText: to.toUpperCase()}).first().click();
    await page.waitForURL(base + routes[to]);
    if (routes === homes) assert.equal(await page.locator('form.estimate-sheet [name="phone"]').inputValue(), '', 'Locale navigation resets the form, as before');
    report.switches.push({from: routes[from], to: routes[to], status: 'PASS'});
  }
  assert.deepEqual(report.pageErrors, []);
  report.status = 'PASS';
  console.log(JSON.stringify({status: 'PASS', layoutChecks: report.layout.length, languageSwitches: report.switches.length}));
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
