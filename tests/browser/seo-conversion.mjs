// Local browser regression only. Every API write and external analytics request is mocked.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import path from 'node:path';

const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href);
const base = process.env.BASE_URL || 'http://127.0.0.1:3137';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname), 'Local test server required');
const output = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/seo-2026-10-26/conversion');
await mkdir(output, {recursive: true});
const browser = await chromium.launch({channel: 'chrome', headless: true});
const context = await browser.newContext({reducedMotion: 'reduce', viewport: {width: 1440, height: 1000}});
const report = {base, mocked: true, layout: [], calculations: 0, forms: [], switches: 0, pageErrors: [], performance: []};
const state = {status: 200, offline: false, writes: []};
await context.addInitScript(() => {
  localStorage.setItem('lc-analytics-consent-v2', 'yes');
  sessionStorage.setItem('lc-analytics-entry', JSON.stringify({landing: '/sr', source: 'google_business_profile'}));
  window.testEvents = [];
  // Observe both direct component emissions and the production consent dispatcher without network.
  window.lcTrack = (name, data) => window.testEvents.push({name, data});
  window.gtag = (...args) => {if (args[0] === 'event' && args[1] !== 'page_view') window.testEvents.push({name:args[1],data:args[2]});};
});
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (/google-analytics|googletagmanager|doubleclick|mc\.yandex/.test(url.hostname)) return route.fulfill({status: 204});
  if (url.pathname.startsWith('/api/')) {
    if (['/api/lead', '/api/upholstery/lead'].includes(url.pathname) && request.method() === 'POST') {
      state.writes.push({api: url.pathname, payload: request.postDataJSON()});
      if (state.offline) return route.abort('timedout');
      return route.fulfill({status: state.status, contentType: 'application/json', body: JSON.stringify(state.status === 200 ? {ok: true, reference: 'LC-MOCK-SEO', result: {reference: 'UP-MOCK-SEO'}} : {ok: false})});
    }
    assert.equal(request.method(), 'GET', `Unexpected API write blocked: ${url.pathname}`);
    return route.fulfill({contentType: 'application/json', body: JSON.stringify(url.pathname === '/api/chat' ? {conversation: null} : {allowed: false})});
  }
  assert.ok(['GET', 'HEAD'].includes(request.method()), 'Non-API write blocked');
  return route.continue();
});
const page = await context.newPage();
page.on('pageerror', e => report.pageErrors.push(e.message));
const regular = {ru: '/ru/services/uborka-kvartir', sr: '/sr/services/ciscenje-stanova', en: '/en/services/apartment-cleaning'};
const deep = {ru: '/ru/services/generalnaya-uborka', sr: '/sr/services/generalno-ciscenje', en: '/en/services/deep-cleaning'};
const upholstery = {ru: '/ru/himchistka-mebeli', sr: '/sr/dubinsko-pranje-namestaja', en: '/en/upholstery-cleaning'};
const expected = {
  regular: [4900,6000,6000,8200,8200,9800,9800,9800,11800],
  deep: [9900,11400,11400,14200,14200,17000,17000,18000,21600],
  move: [10700,12800,12800,15600,15600,18400,18400,18000,21600],
  airbnb: [4900,5800,5800,7400,7400,9000,9000,9000,10800],
  office: [4900,5800,5800,7400,7400,9000,9000,9000,10800],
};
async function go(route) {
  await page.goto(base + route);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => document.readyState === 'complete');
}
async function area(value, amount) {
  await page.locator('.site-area-range').evaluate((el, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, String(value));
    el.dispatchEvent(new Event('input', {bubbles: true})); el.dispatchEvent(new Event('change', {bubbles: true}));
  }, value);
  await page.waitForFunction(amount => Number((document.querySelector('.receipt-total output') || document.querySelector('.receipt-total > strong'))?.textContent.replace(/\D/g, '')) === amount, amount);
}
try {
  for (const locale of ['ru','sr','en']) {
    for (const target of [regular[locale], deep[locale]]) {
      await go(target);
      assert.equal(await page.locator('html').getAttribute('lang'), locale);
      for (const width of [375,768,1440]) {
        await page.setViewportSize({width, height: 1000});
        await page.locator('form.estimate-sheet').scrollIntoViewIfNeeded();
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${target}/${width}`);
        report.layout.push({locale, target, width, height: 1000, status: 'PASS'});
      }
    }
    await go(regular[locale]);
    const form = page.locator('form.estimate-sheet');
    for (const [index, values] of (process.argv.includes('--smoke') ? [] : Object.values(expected)).entries()) {
      await form.locator('.service-options label').nth(index).click();
      for (const [i, value] of [39,40,59,60,79,80,99,100,120].entries()) {await area(value, values[i]); report.calculations++;}
    }
    await form.locator('.service-options label').first().click(); await area(55, 6000);
    await form.locator('[name="phone"]').fill('+381601234567'); await form.locator('.site-consent input').check();
    state.status = 503;
    await form.locator('button[type="submit"]').click(); await form.locator('[role="alert"]').waitFor();
    const first = state.writes.at(-1).payload;
    await page.evaluate(() => sessionStorage.setItem('lc-analytics-entry', JSON.stringify({landing: '/en', source: 'bing'})));
    state.status = 200;
    await form.locator('button[type="submit"]').click(); await form.locator('.site-form-status.success').waitFor();
    assert.deepEqual(state.writes.at(-1).payload, first, 'Attribution and submission key are frozen across retries');
    assert.equal(first.attribution.source, 'google_business_profile'); assert.equal(first.attribution.landing, '/sr');
    assert.equal((await page.evaluate(() => window.testEvents)).filter(e => e.name === 'generate_lead').length, 1);
    assert.ok((await page.evaluate(() => window.testEvents)).some(e => e.name === 'generate_lead' && e.data.form_type === 'estimate'));
    report.forms.push({locale, form: 'estimate', retry: 'PASS', attribution: 'PASS'});

    await go(upholstery[locale]);
    const up = page.locator('form.up-calculator');
    await up.locator('[name="name"]').fill('Synthetic UI'); await up.locator('[name="phone"]').fill('+381601234567'); await up.locator('[name="consent"]').check();
    for (const status of [400,429,503]) {
      state.status = status;
      await up.locator('button[type="submit"]').click(); await up.locator('[role="alert"]').waitFor();
      assert.equal((await page.evaluate(() => window.testEvents)).filter(e => e.name === 'generate_lead').length, 0);
    }
    const initial = state.writes.at(-1).payload;
    await page.evaluate(() => sessionStorage.setItem('lc-analytics-entry', JSON.stringify({landing: '/en', source: 'bing'})));
    state.offline = true;
    await up.locator('button[type="submit"]').click(); await up.locator('[role="alert"]').waitFor();
    state.offline = false; state.status = 200;
    await up.locator('button[type="submit"]').click(); await up.locator('.up-form-status.success').waitFor();
    assert.deepEqual(state.writes.at(-1).payload, initial);
    assert.equal(initial.attribution.source, 'google_business_profile');
    const events = await page.evaluate(() => window.testEvents);
    assert.equal(events.filter(e => e.name === 'generate_lead').length, 1);
    assert.ok(events.some(e => e.name === 'generate_lead' && e.data.service === 'upholstery'));
    assert.ok(!JSON.stringify(events).includes('Synthetic UI')); assert.ok(!JSON.stringify(events).includes('+381601234567'));
    const count = state.writes.length;
    await up.evaluate(el => {el.requestSubmit(); el.requestSubmit();});
    assert.equal(state.writes.length, count, 'No resubmission after success');
    report.forms.push({locale, form: 'upholstery', retries: 'PASS', events: 'PASS', attribution: 'PASS'});

    await go(`/${locale}`);
    await page.evaluate(() => localStorage.setItem('lc-analytics-consent-v2', 'no'));
    const contact = page.locator('.contact-request');
    await contact.locator('[name="phone"]').fill('+381601234567'); await contact.locator('[name="consent"]').check();
    await contact.locator('button[type="submit"]').click(); await contact.locator('[role="status"]').waitFor();
    assert.equal(state.writes.at(-1).payload.attribution, undefined, 'No attribution storage used without analytics consent');
    assert.ok((await page.evaluate(() => window.testEvents)).some(e => e.name === 'generate_lead' && e.data.form_type === 'contact'));
    report.forms.push({locale, form: 'contact', withoutAnalytics: 'PASS'});
    const perf = await page.evaluate(() => ({navigation: performance.getEntriesByType('navigation').map(x => ({ttfb: x.responseStart,domContentLoaded: x.domContentLoadedEventEnd})), paint: performance.getEntriesByType('paint').map(x => ({name: x.name,startTime: x.startTime}))}));
    report.performance.push({locale, note: 'Local lab timing only; not field Core Web Vitals', ...perf});
  }
  for (const routes of [regular, deep]) for (const from of ['ru','sr','en']) for (const to of ['ru','sr','en'].filter(x => x !== from)) {
    await go(routes[from]);
    await page.locator('.site-locales a').filter({hasText: to.toUpperCase()}).first().click();
    await page.waitForURL(base + routes[to]); report.switches++;
  }
  assert.deepEqual(report.pageErrors, []);
  report.status = 'PASS';
  console.log(JSON.stringify({status: report.status, layouts: report.layout.length, calculations: report.calculations, forms: report.forms.length, languageSwitches: report.switches, writesMocked: state.writes.length}));
} finally {
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  await browser.close();
}
