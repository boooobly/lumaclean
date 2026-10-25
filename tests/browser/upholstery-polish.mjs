// Focused UI checks. All API traffic is mocked before the first navigation.
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const drivers = await import(process.env.PLAYWRIGHT_CORE_PATH ? pathToFileURL(process.env.PLAYWRIGHT_CORE_PATH).href : "playwright-core");
const base = process.env.BASE_URL || "http://localhost:3100";
const output = path.resolve(process.env.ARTIFACT_DIR || "artifacts/upholstery-polish");
await mkdir(output, { recursive: true });
const routes = { ru: "/ru/himchistka-mebeli", sr: "/sr/dubinsko-pranje-namestaja", en: "/en/upholstery-cleaning" };
const report = { base, matrix: [], scenarios: [], errors: [], mocked: true };

async function setup(browser, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "no-preference", ...options });
  await context.addInitScript(() => {
    localStorage.setItem("lc-analytics-consent-v1", "no");
    window.__upCls = 0;
    if ("PerformanceObserver" in window && PerformanceObserver.supportedEntryTypes.includes("layout-shift")) {
      new PerformanceObserver(list => list.getEntries().forEach(entry => { if (!entry.hadRecentInput) window.__upCls += entry.value; })).observe({ type: "layout-shift", buffered: true });
    }
  });
  const state = { status: 200, failure: "", writes: [], release: null, intentional: false };
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (/google-analytics|googletagmanager|doubleclick/.test(url.hostname)) return route.fulfill({ status: 204 });
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname === "/api/upholstery/lead" && request.method() === "POST") {
        state.writes.push(request.postDataJSON());
        if (state.failure) return route.abort(state.failure);
        if (state.status === 202) await new Promise(resolve => { state.release = resolve; });
        return route.fulfill({ status: state.status === 202 ? 200 : state.status, contentType: "application/json", body: JSON.stringify(state.status < 400 ? { ok: true, result: { reference: "MOCK-UP-UI" } } : { ok: false }) });
      }
      assert.equal(request.method(), "GET", `Unexpected API write blocked: ${url.pathname}`);
      return route.fulfill({ contentType: "application/json", body: JSON.stringify(url.pathname === "/api/chat" ? { conversation: null } : { allowed: false }) });
    }
    assert.ok(["GET", "HEAD"].includes(request.method()), `Unexpected write blocked: ${url.pathname}`);
    return route.continue();
  });
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push({ text: error.message, intentional: false }));
  page.on("console", message => { if (message.type() === "error") report.errors.push({ text: message.text(), intentional: state.intentional }); });
  if (process.env.PREVIEW_ACCESS_URL) await page.goto(process.env.PREVIEW_ACCESS_URL);
  return { context, page, state };
}

const go = async (page, locale) => { await page.goto(base + routes[locale]); await page.locator(".up-calculator").waitFor(); await page.evaluate(() => document.fonts.ready); };
const settle = page => page.evaluate(async () => { await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
const money = async (page, value) => page.waitForFunction(expected => Number(document.querySelector(".up-total strong")?.textContent.replace(/\D/g, "")) === expected, value);
async function screenshotForm(page, name) {
  await settle(page);
  // Keep floating chrome outside a screenshot dedicated to the form.
  const style = await page.addStyleTag({ content: ".site-header,.website-chat-launcher,nextjs-portal{visibility:hidden!important}" });
  await page.locator(".up-calculator").screenshot({ path: path.join(output, name) });
  await style.evaluate(el => el.remove());
}

try {
  for (const engine of ["chromium", "webkit"]) {
    const browser = await drivers[engine].launch({ headless: true, ...(engine === "chromium" ? { channel: "chrome" } : {}) });
    try {
      const { context, page, state } = await setup(browser);
      for (const locale of Object.keys(routes)) {
        await go(page, locale);
        if (engine === "chromium" && locale === "ru") {
          for (const width of [1440, 390]) { await page.setViewportSize({ width, height: 1000 }); await screenshotForm(page, `after-${width}.png`); }
        }
        await page.locator("#up-furniture-0").selectOption("CORNER");
        await page.locator('.up-furniture input[type="number"]').nth(1).fill("6");
        await page.locator(".up-add").click();
        await page.locator("#up-furniture-1").selectOption("CHAIR");
        await page.locator("#up-quantity-1").fill("2");
        await page.locator('.up-fabric select').first().selectOption("WET_COMPATIBLE");
        await page.locator('.up-fabric select').last().selectOption("UNKNOWN");
        await page.locator('.up-furniture .up-field-grid select').first().selectOption("HEAVY");
        await page.locator('input[name="mode"][value="ADDON"]').check();
        await page.locator('.up-cleaning select').selectOption("move");
        for (const disclosure of await page.locator(".up-item-details summary").all()) await disclosure.click();
        await money(page, 23600);
        for (const width of [1440, 1024, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 1000 });
          await settle(page);
          const controls = await page.locator(".up-calculator select").evaluateAll(selects => selects.map(select => {
            const arrow = select.parentElement.querySelector(".up-select-chevron"), rect = select.getBoundingClientRect(), a = arrow?.getBoundingClientRect(), css = getComputedStyle(select);
            return { appearance: css.appearance, padding: parseFloat(css.paddingRight), gap: a ? rect.right - a.right : -1, centre: a ? Math.abs((rect.top + rect.height / 2) - (a.top + a.height / 2)) : -1, arrowWidth: a?.width, arrowHeight: a?.height, count: select.parentElement.querySelectorAll("svg").length, text: select.selectedOptions[0].textContent };
          }));
          assert.equal(controls.length, 7);
          for (const control of controls) {
            assert.equal(control.appearance, "none");
            assert.equal(control.count, 1);
            assert.equal(control.padding, 48);
            assert.equal(control.arrowWidth, 14);
            assert.equal(control.arrowHeight, 8);
            assert.ok(Math.abs(control.gap - 18) < 1);
            assert.ok(control.centre < 1);
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${engine}/${locale}/${width}: horizontal overflow`);
          report.matrix.push({ engine, locale, width, selects: controls.length, status: "PASS" });
          console.log(`PASS ${engine} ${locale} ${width}: seven native selects, multi-item/expanded/combined form`);
          if (engine === "chromium" && locale === "ru" && [1440, 320].includes(width)) await screenshotForm(page, `expanded-${width}.png`);
        }
        await page.locator('.up-fabric select').first().selectOption("UNSAFE");
        assert.equal(await page.locator(".up-submit").isDisabled(), true);
        await page.locator('.up-fabric select').first().selectOption("WET_COMPATIBLE");
        await money(page, 23600);
        // Error messages occupy a reserved area; the summary height must stay stable.
        const height = (await page.locator(".up-calc-summary").boundingBox()).height;
        await page.locator(".up-submit").click();
        await page.locator("#up-form-status.validation").waitFor();
        assert.equal(state.writes.length, 0);
        assert.ok(Math.abs((await page.locator(".up-calc-summary").boundingBox()).height - height) < 1);
        await page.locator('input[name="name"]').fill("QA Synthetic");
        await page.locator('input[name="phone"]').fill("+381601234567");
        await page.locator('input[name="consent"]').check();
        state.intentional = true;
        for (const status of [400, 429, 503]) {
          state.status = status;
          await page.locator(".up-submit").click();
          await page.locator(`#up-form-status.${status === 400 ? "validation" : status === 429 ? "limited" : "error"}`).waitFor();
          assert.ok(Math.abs((await page.locator(".up-calc-summary").boundingBox()).height - height) < 1);
        }
        for (const failure of ["internetdisconnected", "timedout"]) {
          state.failure = failure;
          await page.locator(".up-submit").click();
          await page.locator("#up-form-status.error").waitFor();
        }
        assert.equal(new Set(state.writes.map(p => p.submissionId)).size, 1);
        state.failure = "";
        state.status = 202;
        await page.locator(".up-submit").click();
        await page.locator("#up-form-status.sending").waitFor();
        assert.equal(await page.locator(".up-submit").isDisabled(), true);
        while (!state.release) await new Promise(resolve => setTimeout(resolve, 10));
        state.release();
        await page.locator("#up-form-status.success").waitFor();
        assert.ok(Math.abs((await page.locator(".up-calc-summary").boundingBox()).height - height) < 1);
        const payload = state.writes.at(-1);
        assert.equal(payload.locale, locale);
        assert.equal(payload.request.items[0].seats, 6);
        assert.equal(payload.request.items[1].quantity, 2);
        assert.equal(payload.request.mode, "ADDON");
        assert.ok(payload.request.items.every(item => !Object.hasOwn(item, "id")));
        state.writes.length = 0;
        state.release = null;
        state.intentional = false;
      }
      await go(page, "ru");
      await page.locator(".up-add").click();
      await page.locator("#up-furniture-1").selectOption("ARMCHAIR");
      await page.locator(".up-item-details summary").last().click();
      await page.locator(".up-item-details textarea").last().fill("Preserve this item");
      const stableId = await page.locator(".up-furniture").last().getAttribute("data-item-id");
      await page.locator(".up-remove").first().click();
      await page.waitForFunction(() => document.querySelectorAll(".up-furniture").length === 1);
      assert.equal(await page.locator(".up-furniture").getAttribute("data-item-id"), stableId);
      assert.equal(await page.locator(".up-item-details textarea").inputValue(), "Preserve this item");
      await money(page, 4000);
      await go(page, "ru");
      await page.locator(".up-gallery-3").click();
      await page.waitForFunction(() => document.querySelector(".up-furniture[data-selected='true'] .up-type select")?.value === "CHAIR" && document.activeElement === document.querySelector(".up-furniture[data-selected='true'] .up-type select"));
      assert.equal(await page.locator(".up-gallery-3").getAttribute("class"), "up-gallery-item up-gallery-3 is-selected");
      report.scenarios.push(`${engine}: native chevrons, all locales, contact/errors/retry/success, no status reflow, stable removal PASS`);

      // Normal motion, reduced-motion toggle, and enhancement failure.
      await page.setViewportSize({ width: 1440, height: 1000 });
      await go(page, "ru");
      const delays = await page.locator(".up-hero h1 > span").evaluateAll(nodes => nodes.map(n => getComputedStyle(n).animationDelay));
      assert.deepEqual(delays, ["0s", "0.08s", "0.16s"]);
      await page.locator(".up-gallery").scrollIntoViewIfNeeded();
      await page.waitForFunction(() => document.getAnimations().some(a => a.playState === "running" && a.effect?.target?.closest?.(".up-gallery")));
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForFunction(() => !document.getAnimations().some(a => a.playState === "running"));
      assert.equal(await page.locator(".up-hero h1 > span").first().evaluate(el => getComputedStyle(el).animationName), "none");
      assert.ok(await page.evaluate(() => (window.__upCls || 0) < 0.01));
      await context.close();
      const fault = await setup(browser, { reducedMotion: "no-preference" });
      await fault.context.addInitScript(() => {
        const NativeObserver = window.IntersectionObserver;
        window.IntersectionObserver = new Proxy(NativeObserver, { construct(Target, args) {
          if (args[1]?.rootMargin === "0px 0px -28px 0px") { window.__upIoFailure = true; throw Error("Synthetic unavailable observer"); }
          return Reflect.construct(Target, args);
        } });
      });
      await go(fault.page, "ru");
      await fault.page.waitForFunction(() => window.__upIoFailure === true);
      assert.equal(await fault.page.locator(".up-gallery-item").first().evaluate(el => getComputedStyle(el).opacity), "1");
      await fault.context.close();
      const noJs = await setup(browser, { javaScriptEnabled: false, reducedMotion: "reduce" });
      await go(noJs.page, "en");
      for (const selector of ["h1", ".up-gallery-item", ".up-steps", ".up-price-table", ".up-calculator"]) assert.equal(await noJs.page.locator(selector).first().isVisible(), true);
      await noJs.context.close();
      report.scenarios.push(`${engine}: stagger/reveal, reduced-motion, CLS < .01, failed observer and disabled JavaScript content visibility PASS`);
    } finally { await browser.close(); }
  }
  assert.deepEqual(report.errors.filter(error => !error.intentional), []);
  report.status = "PASS";
  console.log(JSON.stringify({ status: report.status, matrix: report.matrix.length, scenarios: report.scenarios, unexpectedErrors: 0 }, null, 2));
} catch (error) {
  report.status = "FAIL";
  report.failure = error.stack;
  throw error;
} finally { await writeFile(path.join(output, "polish-report.json"), JSON.stringify(report, null, 2)); }
