// Runs without browser, network, credentials or sending enquiries.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';
const exportsObject = {};
const code = ts.transpileModule(fs.readFileSync('src/lib/analytics.ts', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}
}).outputText;
vm.runInNewContext(code, {exports: exportsObject, URL, URLSearchParams});
const {entrySource, acquisitionContext, entrySources, safeEventData} = exportsObject;
const campaign = '?utm_source=google&utm_medium=organic&utm_campaign=google_business_profile';
assert.equal(entrySource('', campaign), 'google_business_profile');
assert.equal(entrySource('https://www.google.com/search?q=private', ''), 'google');
assert.equal(entrySource('https://yandex.ru/search/?text=private', ''), 'yandex');
assert.equal(entrySource('https://www.bing.com/search?q=private', ''), 'bing');
assert.equal(entrySource('', '?utm_source=google&utm_medium=cpc&utm_campaign=google_business_profile'), 'direct_or_unknown');
assert.equal(entrySource('', '?utm_source=client@example.com'), 'direct_or_unknown');
assert.equal(entrySource('https://www.google.com.evil.example/?secret=1', ''), 'referral');
assert.equal(acquisitionContext('google').page_referrer, 'https://www.google.com/');
assert.equal(acquisitionContext('referral').page_referrer, '');
assert.equal(acquisitionContext(entrySource('', campaign + '&phone=PRIVATE')).campaign_name, 'google_business_profile');
assert(!JSON.stringify(acquisitionContext(entrySource('', campaign + '&phone=PRIVATE'))).includes('PRIVATE'));
assert(entrySources.includes('google_business_profile'));
assert.equal(JSON.stringify(safeEventData({locale:'ru',service:'regular',phone:'PRIVATE'}, [])), '{"locale":"ru","service":"regular"}');
console.log('PASS: campaign recognition, search attribution, spoofed hosts and private-value filtering');

// Execute the real component effect with in-memory browser adapters; no network.
const local = new Map();
const session = new Map();
const storage = map => ({getItem: key => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: key => map.delete(key)});
const localStorage = storage(local);
const sessionStorage = storage(session);
let pathname = '/sr';
let effect;
let cleanup;
let refIndex = 0;
let stateIndex = 0;
let metrikaReady = false;
let clickHandler;
const refs = [];
const w = {location: {search: campaign + '&analytics_debug=1&phone=PRIVATE', hostname: 'lumacleanrs.com', origin: 'https://lumacleanrs.com'}, addEventListener() {}, removeEventListener() {}};
const react = {
  useEffect: fn => {effect = fn;},
  useRef: initial => refs[refIndex++] ||= {current: initial},
  useState: initial => [stateIndex++ === 1 ? metrikaReady : initial, () => {}],
  useSyncExternalStore: (_, read) => read(),
};
const componentExports = {};
const componentCode = ts.transpileModule(fs.readFileSync('src/components/site/analytics.tsx', 'utf8'), {
  compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX}
}).outputText;
const modules = {'react': react, 'react/jsx-runtime': {jsx: () => null, jsxs: () => null}, 'next/script': {}, 'next/navigation': {usePathname: () => pathname}, '@/lib/analytics': exportsObject, '@/components/site/arrow-icon': {ArrowIcon: () => null}, './analytics.css': {}};
vm.runInNewContext(componentCode, {exports: componentExports, require: name => {assert(name in modules, name); return modules[name];}, window: w, document: {referrer: '', title: 'LumaClean', addEventListener(name, fn) {if (name === 'click') clickHandler = fn;}, removeEventListener(name, fn) {if (name === 'click' && clickHandler === fn) clickHandler = undefined;}}, localStorage, sessionStorage, URL, URLSearchParams, Date});
function render() {
  cleanup?.(); refIndex = 0; stateIndex = 0;
  componentExports.Analytics({locale:'sr', measurementId:'G-TEST123', metrikaId:'113807461', enabled:true, paths:['/sr','/sr/services/ciscenje-stanova']});
  cleanup = effect();
}
render();
assert.equal(w.dataLayer, undefined, 'No collection before consent');
assert.equal(session.size, 0, 'No attribution storage before consent');
local.set('lc-analytics-consent-v1', 'yes');
render();
assert.equal(w.ym, undefined, 'Old Google-only consent must not authorize Yandex');
local.set('lc-analytics-consent-v2', 'yes');
render();
assert.equal(w.ym.a.length, 0, 'No Metrika calls before the library is ready');
metrikaReady = true;
render();
assert.equal(w.ym.a.filter(args => args[1] === 'init').length, 1);
const ymConfig = w.ym.a.find(args => args[1] === 'init')[2];
for (const option of ['webvisor','clickmap','trackLinks','ecommerce','trackHash','accurateTrackBounce','sendTitle']) assert.equal(ymConfig[option], false);
assert.equal(ymConfig.defer, true);
let commands = w.dataLayer.map(args => Array.from(args));
let page = commands.find(args => args[0] === 'event' && args[1] === 'page_view')[2];
assert.equal(page.entry_source, 'google_business_profile');
assert.equal(page.page_location, 'https://lumacleanrs.com/sr');
assert.equal(page.traffic_type, 'internal');
assert.equal(commands.find(args => args[0] === 'config')[2].campaign_name, 'google_business_profile');
assert(!JSON.stringify(commands).includes('PRIVATE'));
pathname = '/sr/services/ciscenje-stanova'; w.location.search = '';
render();
w.lcTrack('calculator_interaction', {locale:'sr', service:'regular'});
commands = w.dataLayer.map(args => Array.from(args));
page = commands.filter(args => args[0] === 'event' && args[1] === 'page_view').at(-1)[2];
assert.equal(page.landing_page, '/sr');
assert.equal(page.entry_source, 'google_business_profile');
assert.equal(page.traffic_type, 'internal', 'Debug persists after navigation');
assert.equal(commands.at(-1)[2].traffic_type, 'internal');
assert.equal(commands.filter(args => args[1] === 'generate_lead').length, 0);
for (const href of ['tel:+381PRIVATE', 'https://wa.me/PRIVATE?text=PRIVATE']) {
  clickHandler({target: {closest: () => ({getAttribute: () => href})}});
}
commands = w.dataLayer.map(args => Array.from(args));
assert.equal(commands.filter(args => args[1] === 'phone_click').length, 1);
assert.equal(commands.filter(args => args[1] === 'messenger_click').length, 1);
assert(!JSON.stringify(commands).includes('PRIVATE'), 'Contact details must never reach analytics');
assert.equal(w.ym.a.filter(args => args[1] === 'hit').length, 2);
assert.equal(w.ym.a.filter(args => args[1] === 'reachGoal' && args[2] === 'phone_click').length, 1);
assert(!JSON.stringify(w.ym.a).includes('PRIVATE'), 'Metrika must not receive query strings or contacts');
local.set('lc-analytics-consent-v2', 'no');
render();
assert.equal(w.lcTrack, undefined);
assert.equal(clickHandler, undefined, 'Revoking consent removes delegated contact tracking');
assert.equal(w['ga-disable-G-TEST123'], true);
assert.equal(w.ym.a.at(-1)[1], 'destruct', 'Withdrawn consent destroys the Metrika counter');
local.set('lc-analytics-consent-v2', 'yes'); render();
assert.equal(w.ym.a.filter(args => args[1] === 'init').length, 2, 'Consent can be granted again without duplicate counters');
console.log('PASS: real analytics effect, consent, navigation, debug persistence and no fabricated leads');
