import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
require('tsx/cjs');
const {siteContent} = require('../../src/lib/content.ts');
const {chromium} = await import(pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH));
const base = process.env.BASE_URL;
assert.ok(base && ['127.0.0.1', 'localhost'].includes(new URL(base).hostname));
const browser = await chromium.launch({channel: 'chrome', headless: true});
const rows = [];
try {
  // Chat language may differ from the page language, including Cyrillic Serbian.
  for (const locale of ['ru', 'sr-Latn', 'sr-Cyrl', 'en']) {
    const lang = locale.startsWith('sr') ? 'sr' : locale;
    const context = await browser.newContext();
    const conversation = {displayAlias: 'Synthetic', locale, revision: 1, typing: false, quickReplies: null, messages: [], control: 'HUMAN_CONTROL', pending: false, confirmation: null,
      booking: {reference: 'LC-SYNTHETIC', recap: {service: 'regular', area: 55, extras: [{code: 'oven', quantity: 1}], address: 'Synthetic address', start: '2026-11-04T09:00:00Z', durationMinutes: 120, price: 7400, currency: 'RSD'}}};
    let loaded = false;
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.pathname === '/api/chat/events') return route.fulfill({contentType: 'text/event-stream', body: `event: message\ndata: ${JSON.stringify({conversation})}\n\n`});
      if (url.pathname === '/api/chat') {assert.equal(request.method(), 'GET'); loaded = true; return route.fulfill({json: {ok: true, conversation}});}
      if (url.pathname.startsWith('/api/')) {assert.equal(request.method(), 'GET'); return route.fulfill({json: {allowed: true}});}
      if (url.origin !== base) return route.fulfill({status: 204});
      assert.ok(['GET', 'HEAD'].includes(request.method())); return route.continue();
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const initial = page.waitForResponse(response => response.url().endsWith('/api/chat'));
    await page.goto(base + '/ru');
    await page.waitForFunction(() => document.querySelector('.website-chat-launcher'));
    await initial;
    assert.ok(loaded);
    await page.locator('.website-chat-launcher').click();
    await page.locator('.website-chat-recap').waitFor();
    const text = await page.locator('.website-chat-recap').innerText();
    assert.ok(text.includes(siteContent[lang].calculator.service));
    assert.ok(text.includes(siteContent[lang].services.find(service => service.id === 'regular').name));
    assert.ok(text.includes(siteContent[lang].calculator.labels.oven + ' × 1'));
    assert.deepEqual(errors, []);
    rows.push({page: '/ru', chatLocale: locale, status: 'PASS'});
    await context.close();
  }
} finally {await browser.close();}
await mkdir('artifacts/vercel-pro-20261101', {recursive: true});
await writeFile('artifacts/vercel-pro-20261101/recap.json', JSON.stringify({mocked: true, rows}, null, 2));
console.log(`PASS ${rows.length} booking recap locales, including a different page language`);
