// Safe browser regression. Run with BASE_URL and PLAYWRIGHT_CORE_PATH (index.mjs).
// All /api traffic and external analytics are intercepted before navigation.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const { chromium } = await import(process.env.PLAYWRIGHT_CORE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href : "playwright-core");
const base = process.env.BASE_URL || "http://localhost:3101";
const output = path.resolve(process.env.ARTIFACT_DIR || "artifacts/upholstery-premium");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ reducedMotion: "reduce" });
await context.addInitScript(() => localStorage.setItem("lc-analytics-consent-v1", "no"));
const page = await context.newPage();
const report = { base, date: new Date().toISOString(), layout: [], scenarios: [], consoleErrors: [], pageErrors: [], writes: [], mocked: true };
let apiStatus = 200, failure = "", hold = null, intentionalFailure = false;
page.on("pageerror", error => report.pageErrors.push(error.message));
page.on("console", message => { if (message.type() === "error") report.consoleErrors.push({ text: message.text(), intentionalFailure }); });
await context.route("**/*", async route => {
  const request = route.request(), url = new URL(request.url());
  if (/google-analytics|googletagmanager|analytics\.google|doubleclick/.test(url.hostname)) return route.fulfill({ status: 204 });
  if (url.pathname.startsWith("/api/")) {
    if (url.pathname === "/api/upholstery/lead" && request.method() === "POST") {
      report.writes.push(request.postDataJSON());
      if (failure === "offline") return route.abort("internetdisconnected");
      if (failure === "timeout") return route.abort("timedout");
      if (failure === "hold") await new Promise(resolve => { hold = resolve; });
      return route.fulfill({ status: apiStatus, contentType: "application/json", body: JSON.stringify(apiStatus === 200 ? { ok: true, result: { reference: "MOCK-UP-001" } } : { ok: false }) });
    }
    assert.equal(request.method(), "GET", `Unexpected write blocked: ${url.pathname}`);
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(url.pathname === "/api/chat" ? { conversation: null } : { allowed: false }) });
  }
  if (!["GET", "HEAD"].includes(request.method())) throw Error(`Unexpected write: ${url.pathname}`);
  return route.continue();
});
const routes = { ru: "/ru/himchistka-mebeli", sr: "/sr/dubinsko-pranje-namestaja", en: "/en/upholstery-cleaning" };
const money = async () => Number((await page.locator(".up-total strong").innerText()).replace(/\D/g, ""));
const expectMoney = async amount => {
  await page.waitForFunction(expected => Number(document.querySelector(".up-total strong")?.textContent.replace(/\D/g, "")) === expected, amount);
  assert.equal(await money(), amount);
};
const go = async locale => {
  await page.goto(base + routes[locale], { waitUntil: "networkidle" });
  await page.locator(".up-calculator").waitFor();
  await page.evaluate(() => document.fonts.ready);
};

try {
  for (const locale of Object.keys(routes)) {
    await go(locale);
    assert.equal(await page.locator("html").getAttribute("lang"), locale);
    assert.equal(await page.locator("h1").count(), 1);
    assert.ok((await page.title()).includes("LumaClean"));
    assert.ok((await page.locator('meta[name="description"]').getAttribute("content")).length > 50);
    assert.equal(await page.locator('link[rel="canonical"]').getAttribute("href"), "https://lumacleanrs.com" + routes[locale]);
    for (const language of Object.keys(routes)) {
      assert.equal(await page.locator(`link[rel="alternate"][hreflang="${language}"]`).getAttribute("href"), "https://lumacleanrs.com" + routes[language]);
      assert.equal(await page.locator(`.site-locales a:has-text("${language.toUpperCase()}")`).getAttribute("href"), routes[language]);
    }
    assert.ok((await page.locator(".up-price-table").innerText()).includes("RSD"));
    assert.equal(await page.locator(".up-price-table tbody tr").count(), 6);
    for (const width of [1440, 1024, 768, 390, 375, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 800) {
          window.scrollTo(0, y);
          await new Promise(requestAnimationFrame);
          await new Promise(requestAnimationFrame);
        }
        await Promise.all([...document.images].map(img => img.decode().catch(() => {})));
        window.scrollTo(0, 0);
      });
      const layout = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth, brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.src), overflow: [...document.querySelectorAll("main *")].filter(el => { const r = el.getBoundingClientRect(); return r.width && (r.right > innerWidth + 1 || r.left < -1); }).map(el => el.className).slice(0, 12) }));
      assert.ok(layout.scroll <= layout.width, `${locale} ${width}: horizontal overflow ${JSON.stringify(layout)}`);
      assert.deepEqual(layout.brokenImages, [], `${locale} ${width}: broken images`);
      report.layout.push({ locale, width, height: 1000, ...layout, status: "PASS" });
      console.log(`Layout PASS: ${locale} ${width}`);
      if ([1440, 390].includes(width)) {
        await page.screenshot({ path: path.join(output, `${locale}-${width}.png`), fullPage: true });
        await page.screenshot({ path: path.join(output, `${locale}-${width}-hero.png`) });
      }
      // Expanded FAQs and the full form must also fit narrow screens.
      if (width === 320) {
        await page.locator(".up-faq summary").first().click();
        await page.locator(".up-item-details summary").click();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      }
    }
    await page.setViewportSize({ width: 390, height: 900 });
    await expectMoney(4600);
    await page.locator("#up-furniture-0").selectOption("CHAIR");
    await expectMoney(4000);
    await page.locator('input[name="mode"][value="ADDON"]').check();
    await expectMoney(6600);
    await page.locator("#up-quantity-0").fill("2");
    await expectMoney(7200);
    await page.locator("#up-furniture-0").selectOption("CORNER");
    await page.locator('.up-furniture input[type="number"]').nth(1).fill("6");
    await expectMoney(25200);
    await page.locator("#up-quantity-0").fill("1");
    await expectMoney(15600);
    await page.locator('.up-fabric select').selectOption("UNSAFE");
    assert.equal(await page.locator(".up-submit").isDisabled(), true);
    assert.equal(await page.locator(".up-total strong").innerText(), "—");
    await page.locator('.up-fabric select').selectOption("UNKNOWN");
    await page.locator('.up-furniture .up-field-grid select').first().selectOption("HEAVY");
    await expectMoney(15600);
    assert.equal(await page.locator(".up-warning").count(), 1);
    await page.locator(".up-submit").click();
    await page.locator("#up-form-status.validation").waitFor();
    assert.equal(report.writes.length, 0);
    await page.locator('input[name="name"]').fill("QA Test");
    await page.locator('input[name="phone"]').fill("+381 60 1234567");
    await page.locator('input[name="consent"]').check();
    apiStatus = 200;
    await page.locator(".up-submit").click();
    await page.locator("#up-form-status.success").waitFor();
    const payload = report.writes.at(-1);
    assert.equal(payload.locale, locale);
    assert.equal(payload.request.mode, "ADDON");
    assert.equal(payload.request.items[0].seats, 6);
    assert.equal(payload.request.items[0].soil, "HEAVY");
    assert.equal(payload.request.cleaning.area, 55);
    assert.equal(payload.consent, true);
    assert.match(payload.submissionId, /^[0-9a-f-]{36}$/);
    assert.ok(await page.locator(".up-submit").isDisabled());
    report.scenarios.push(`${locale}: pricing, quantity, corner seats, combined cleaning, unsafe/unknown fabric, heavy soil, validation, mocked submit PASS`);
    // A fresh page resets form data when the language is changed.
    report.writes.length = 0;
  }

  await go("ru");
  await page.locator(".up-gallery-2").click();
  assert.equal(await page.locator("#up-furniture-0").inputValue(), "ARMCHAIR");
  await page.locator(".up-gallery-3").click();
  assert.equal(await page.locator("#up-furniture-1").inputValue(), "CHAIR");
  await expectMoney(4000);
  await page.locator(".up-remove").last().click();
  await page.locator("#up-furniture-0").selectOption("SOFA3");
  await page.locator(".up-add").click();
  await page.locator("#up-furniture-1").selectOption("SPOT");
  assert.equal(await page.locator(".up-total strong").innerText(), "—");
  await page.locator(".up-object-label input").nth(0).fill("Sofa");
  await page.locator(".up-object-label input").nth(1).fill("Sofa");
  assert.equal(await page.locator(".up-total strong").innerText(), "—");
  await page.locator(".up-object-label input").nth(1).fill("Kitchen chair");
  await expectMoney(5600);
  await page.locator(".up-remove").last().click();
  await expectMoney(4600);
  await page.locator(".up-counter button").last().click();
  await expectMoney(9200);
  await page.locator(".up-counter button").first().click();
  await expectMoney(4600);
  await page.locator("#up-quantity-0").fill("31");
  assert.equal(await page.locator(".up-total strong").innerText(), "—");
  await page.locator("#up-quantity-0").fill("1");
  await page.locator('input[name="name"]').fill("QA Test");
  await page.locator('input[name="phone"]').fill("123");
  await page.locator(".up-submit").click();
  await page.locator("#up-form-status.validation").waitFor();
  assert.equal(report.writes.length, 0);
  await page.locator('input[name="phone"]').fill("+381 60 1234567");
  await page.locator('input[name="consent"]').check();
  intentionalFailure = true;
  for (const code of [400, 429, 503]) {
    apiStatus = code;
    await page.locator(".up-submit").click();
    await page.locator(`#up-form-status.${code === 400 ? "validation" : code === 429 ? "limited" : "error"}`).waitFor();
  }
  failure = "offline";
  await page.locator(".up-submit").click();
  await page.locator("#up-form-status.error").waitFor();
  failure = "timeout";
  await page.locator(".up-submit").click();
  await page.locator("#up-form-status.error").waitFor();
  assert.equal(new Set(report.writes.map(p => p.submissionId)).size, 1, "Retries must preserve idempotency key");
  await page.locator('input[name="name"]').fill("QA Changed");
  failure = "hold";
  apiStatus = 200;
  const before = report.writes.length;
  await page.locator(".up-submit").click();
  await page.locator("#up-form-status.sending").waitFor();
  assert.ok(await page.locator(".up-submit").isDisabled());
  await page.waitForFunction(() => document.querySelector(".up-calculator")?.getAttribute("aria-busy") === "true");
  // Guard against repeated programmatic submit events while awaiting a response.
  await page.locator(".up-calculator").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
  assert.equal(report.writes.length, before + 1);
  assert.notEqual(report.writes.at(-1).submissionId, report.writes.at(-2).submissionId);
  while (!hold) await new Promise(resolve => setTimeout(resolve, 10));
  hold();
  await page.locator("#up-form-status.success").waitFor();
  intentionalFailure = false;
  report.scenarios.push("Gallery selection, add/remove, mixed stain validation, quantity bounds, error/400/429/503/offline/timeout, stable idempotency, changed payload key, loading/double-submit guard PASS");

  await go("en");
  await page.locator(".up-actions .upholstery-cta").first().click();
  await page.locator('input[type="file"]').waitFor({ state: "attached" });
  assert.equal(report.writes.length, before + 1);
  report.scenarios.push("Photo CTA opens existing chat with attachment input; no messages/uploads sent PASS");
  await page.screenshot({ path: path.join(output, "photo-chat.png") });

  // Check all six language-switch directions through real navigation.
  for (const source of Object.keys(routes)) for (const target of Object.keys(routes).filter(l => l !== source)) {
    await go(source);
    await page.locator(`.site-locales a:has-text("${target.toUpperCase()}")`).click();
    await page.waitForURL(base + routes[target]);
    assert.equal(await page.locator('input[name="name"]').inputValue(), "");
  }
  report.scenarios.push("All six language directions navigate to equivalent page; form resets PASS");
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors.filter(e => !e.intentionalFailure), []);
  report.status = "PASS";
  console.log(JSON.stringify({ status: report.status, layoutChecks: report.layout.length, scenarios: report.scenarios, expectedNegativeConsoleErrors: report.consoleErrors.length }, null, 2));
} catch (error) {
  report.status = "FAIL";
  report.failure = error.stack;
  await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true });
  throw error;
} finally {
  await writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2));
  await browser.close();
}
