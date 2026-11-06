// Local UI only: API calls and external analytics are mocked before navigation.
import assert from 'node:assert/strict';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const drivers = await import(process.env.PLAYWRIGHT_CORE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href : 'playwright-core');
const engine = process.env.BROWSER_ENGINE || 'chromium';
const base = process.env.BASE_URL || 'http://127.0.0.1:3111';
assert.ok(['127.0.0.1','localhost'].includes(new URL(base).hostname), 'Use an isolated local UI server');
const output = path.resolve(process.env.ARTIFACT_DIR || 'artifacts/homepage-stage1');
const before = process.argv.includes('--before');
const captureOnly = process.argv.includes('--capture-only');
const phase = before ? 'before' : 'after';
await mkdir(path.join(output, phase), {recursive:true});
const browser = await drivers[engine].launch({...engine === 'chromium' ? {channel:'chrome'} : {}, headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
await context.addInitScript(() => localStorage.setItem('lc-analytics-consent-v2','no'));
await context.route('**/*', async route => {
  const request = route.request(), url = new URL(request.url());
  if (url.pathname.startsWith('/api/')) return route.fulfill({json:url.pathname === '/api/chat' ? {ok:true,conversation:null} : {allowed:true}});
  if (url.origin !== base) return route.fulfill({status:204});
  if (!['GET','HEAD'].includes(request.method()) && !url.pathname.startsWith('/__nextjs')) return route.abort('blockedbyclient');
  return route.continue();
});
const page = await context.newPage();
const report = {phase,base,mocked:true,matrix:[],content:{},links:[],errors:[]};
page.on('pageerror', error => report.errors.push(error.message));
page.on('console', message => {if (message.type() === 'error') report.errors.push(message.text());});
const baseline = before ? null : JSON.parse(await readFile(path.resolve(process.env.BASELINE_PATH || path.join(output,'before.json')),'utf8'));
const selectors = {scope:'#scope',estimate:'#estimate',terms:'#terms',faq:'#faq'};
async function settle() {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === 'running' && a.effect?.target?.closest?.('#estimate, #faq')));
}
try {
  for (const locale of ['ru','sr','en']) {
    await page.setViewportSize({width:1440,height:1000});
    await page.goto(`${base}/${locale}`);
    await page.locator('#estimate select').waitFor();
    await settle();
    report.content[locale] = await page.evaluate(() => ({
      cards:[...document.querySelectorAll('.scope-comparison article')].map(el => el.textContent),
      terms:[...document.querySelectorAll('.evidence-ledger article')].map(el => el.textContent),
      faq:[...document.querySelectorAll('.site-faq-list details')].map(el => ({q:el.querySelector('strong').textContent,a:el.querySelector('p').textContent})),
      faqSchema:[...document.querySelectorAll('script[type="application/ld+json"]')].map(el => JSON.parse(el.textContent)).find(s => s['@type'] === 'FAQPage'),
      options:[...document.querySelectorAll('#estimate select option')].map(el => ({value:el.value,text:el.textContent})),
      metadata:{title:document.title,description:document.querySelector('meta[name="description"]')?.content,canonical:document.querySelector('link[rel="canonical"]')?.href,alternates:[...document.querySelectorAll('link[hreflang]')].map(el=>[el.hreflang,el.href])},
    }));
    if (!before) {
      assert.deepEqual(report.content[locale], baseline.content[locale], `${locale}: existing content and metadata preserved`);
      assert.equal(await page.locator('.service-directory > a').count(),3);
      assert.equal(await page.locator('.scope-comparison h3 a').count(),2);
      assert.equal(await page.locator('a a, a button, summary button, summary a').count(),0);
      for (const link of await page.locator('.scope-comparison h3 a, .service-directory > a').all()) {
        const href=await link.getAttribute('href');
        const response=await context.request.get(base+href);
        assert.equal(response.status(),200,href);
        report.links.push({locale,href,status:response.status()});
      }
    }
    const hidden = await page.addStyleTag({content:'.site-header,.website-chat,nextjs-portal{visibility:hidden!important}'});
    for (const width of [1440,1024,768,390,320]) {
      await page.setViewportSize({width,height:1000});
      await settle();
      const geometry = await page.evaluate(() => {
        const form = getComputedStyle(document.querySelector('#estimate'));
        return {overflow:document.documentElement.scrollWidth>innerWidth,corners:[form.borderTopLeftRadius,form.borderTopRightRadius,form.borderBottomRightRadius,form.borderBottomLeftRadius],cards:[...document.querySelectorAll('.evidence-ledger article')].map(el=>Math.round(el.getBoundingClientRect().height))};
      });
      assert.equal(geometry.overflow,false,`${locale}/${width}: page overflow`);
      if (!before) {
        assert.deepEqual(geometry.corners.slice(0,3),['0px','0px','0px']);
        assert.ok(parseFloat(geometry.corners[3])>0);
        if(width>=1024)assert.ok(geometry.cards.every(h=>h>=150&&h<=190),`${locale}/${width}: terms height ${geometry.cards}`);
      }
      for (const [name,selector] of Object.entries(selectors)) {
        await page.locator(selector).scrollIntoViewIfNeeded();
        await page.waitForFunction(selector=>[...document.querySelector(selector).querySelectorAll('img')].every(img=>img.complete&&img.naturalWidth>0),selector);
        await page.locator(selector).screenshot({path:path.join(output,phase,`${locale}-${width}-${name}.png`),animations:'disabled'});
      }
      if (!before && !captureOnly) {
        for (const disclosure of await page.locator('.estimate-other, .estimate-extras-disclosure, .site-faq-list details').all()) {
          const summary = disclosure.locator('summary');
          const wasOpen = await disclosure.getAttribute('open') !== null;
          await summary.focus();
          await summary.press('Enter');
          await settle();
          assert.equal(await disclosure.getAttribute('open') !== null,!wasOpen);
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${locale}/${width}: expanded overflow`);
          await summary.press('Space');
          await settle();
          assert.equal(await disclosure.getAttribute('open') !== null,wasOpen);
        }
        await page.locator('.estimate-other summary').click();
        await page.locator('.estimate-extras-disclosure summary').click();
        await settle();
        await page.locator('#estimate').screenshot({path:path.join(output,phase,`${locale}-${width}-expanded.png`),animations:'disabled'});
        await page.locator('.estimate-other summary').click();
        await page.locator('.estimate-extras-disclosure summary').click();
        await settle();
        assert.ok(await page.locator('.homepage-faq-image img').evaluate(el=>el.complete&&el.naturalWidth>0));
      }
      report.matrix.push({locale,width,height:1000,status:'PASS',...geometry});
      console.log(`${phase}: ${locale} ${width} PASS`);
    }
    await hidden.evaluate(el=>el.remove());
  }
  if (!before && !captureOnly) {
    report.animation = [];
    for (const selector of ['.estimate-other','.estimate-extras-disclosure','.site-faq-list details:last-child']) {
      const samples = await page.locator(selector).evaluate(async el => {
        el.open=false;
        await new Promise(resolve=>setTimeout(resolve,320));
        const closed=el.getBoundingClientRect().height;
        el.querySelector('summary').click();
        const opening=[], openedAt=performance.now();
        while(performance.now()-openedAt<400) {
          await new Promise(requestAnimationFrame);
          opening.push(el.getBoundingClientRect().height);
        }
        const expanded=el.getBoundingClientRect().height;
        el.querySelector('summary').click();
        const closing=[], closedAt=performance.now();
        while(performance.now()-closedAt<400) {
          await new Promise(requestAnimationFrame);
          closing.push(el.getBoundingClientRect().height);
        }
        return {supported:CSS.supports('interpolate-size:allow-keywords')&&CSS.supports('selector(details::details-content)'),closed,expanded,opening,closing,final:el.getBoundingClientRect().height};
      });
      report.animation.push({selector,...samples});
      assert.ok(samples.expanded>samples.closed);
      assert.equal(samples.final,samples.closed);
      if(samples.supported) {
        assert.ok(samples.opening.some(h=>h>samples.closed+1&&h<samples.expanded-1),`${selector}: smooth opening`);
        assert.ok(samples.closing.some(h=>h>samples.closed+1&&h<samples.expanded-1),`${selector}: smooth closing`);
      }
    }
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('.site-faq-list summary').last().focus();
    await page.locator('.site-faq-list summary').last().press('Enter');
    assert.equal(await page.locator('.site-faq-list details').last().evaluate(el=>getComputedStyle(el,'::details-content').transitionDuration),'0s');
    await page.locator('#estimate select').selectOption('UPHOLSTERY');
    assert.equal(await page.locator('#estimate .receipt-total').count(),0);
    await page.locator('#estimate').screenshot({path:path.join(output,phase,'upholstery-only-320.png'),animations:'disabled'});
    await page.locator('#estimate select').selectOption('CLEANING');
  }
  assert.deepEqual(report.errors,[]);
} finally {
  await writeFile(path.join(output,`${phase}${captureOnly ? '-capture' : ''}.json`),JSON.stringify(report,null,2));
  await browser.close();
}
