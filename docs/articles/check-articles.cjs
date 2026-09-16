/* eslint-disable @typescript-eslint/no-require-imports -- This standalone .cjs harness runs in Node without changing the app's module configuration. */
/* Run from the repository: node docs/articles/check-articles.cjs [origin] [preview|production|published]
 * No source files or external services are changed. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const repo = process.cwd();
const ts = require(path.join(repo, 'node_modules/typescript'));

function modules(env, publishFixture = false) {
  const cache = new Map();
  function load(name, parent = path.join(repo, 'src/entry.ts')) {
    if (name === 'server-only') return {};
    if (name === 'next-intl/routing') return {defineRouting: value => value};
    if (name === 'next-intl') return {hasLocale: (locales, value) => locales.includes(value)};
    if (name === 'next-intl/server') return {setRequestLocale() {}};
    if (name === 'next/navigation') return {notFound() {throw new Error('NOT_FOUND');}};
    if (name === 'next/image' || name === 'next/link' || name.startsWith('@/components/') || name === '@/lib/site-content' || name === 'react/jsx-runtime') return {};
    let filename = name.startsWith('@/') ? path.join(repo, 'src', name.slice(2)) : path.resolve(path.dirname(parent), name);
    filename = [filename, filename + '.ts', filename + '.tsx', path.join(filename, 'index.ts')].find(file => fs.existsSync(file) && fs.statSync(file).isFile());
    if (!filename) throw new Error('Cannot resolve ' + name);
    if (cache.has(filename)) return cache.get(filename).exports;
    let source = fs.readFileSync(filename, 'utf8');
    if (publishFixture && source.includes(': Article =')) {
      source = source.replace(/status: "published"/g, 'status: "draft"').replace(/publishedAt:\s*"[^"]*",?/g, '');
      if (filename.endsWith('regular-deep.ts')) source = source.replace('status: "draft"', 'status: "published", publishedAt: "2026-09-14"');
    }
    const compiled = ts.transpileModule(source, {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX}}).outputText;
    const loadedModule = {exports: {}};
    cache.set(filename, loadedModule);
    vm.runInNewContext('(function(require,module,exports,process){' + compiled + '\n})', {console, URL, Intl, Date})(n => load(n, filename), loadedModule, loadedModule.exports, {env});
    return loadedModule.exports;
  }
  return load;
}

async function main() {
  const prod = {NODE_ENV: 'production', VERCEL_ENV: 'production', VERCEL: '1', ARTICLES_PREVIEW: '1'};
  const publicLoad = modules(prod);
  const publishedCount = publicLoad('@/lib/articles').getPublishedArticles().length;
  assert.equal(publicLoad('@/lib/articles').getVisibleArticles().length, publishedCount, 'Production must ignore the preview flag');
  for (const article of publicLoad('@/lib/articles').getVisibleArticles()) {
    const related = publicLoad('@/lib/articles').getRelatedArticles(article);
    assert.ok(related.every(a => a.status === 'published' && a.id !== article.id), 'Related cards must exclude drafts and self');
    assert.equal(new Set(related.map(a => a.id)).size, related.length);
  }
  const expectedMapSize = 18 + publishedCount * 3 + (publishedCount ? 3 : 0);
  assert.equal(publicLoad('@/app/sitemap').default().length, expectedMapSize, 'Drafts must not enter the sitemap');
  const previewLoad = modules({NODE_ENV: 'production', ARTICLES_PREVIEW: '1'});
  const catalog = previewLoad('@/lib/articles');
  const allCount = catalog.getVisibleArticles().length;
  assert.ok(allCount >= 4);
  assert.equal(modules({NODE_ENV:'production', VERCEL_ENV:'preview', VERCEL:'1'})('@/lib/articles').getVisibleArticles().length, allCount);
  assert.equal(modules({NODE_ENV:'production'})('@/lib/articles').getVisibleArticles().length, publishedCount);
  const fixture = modules(prod, true);
  const fixtureCatalog = fixture('@/lib/articles');
  assert.equal(fixtureCatalog.getVisibleArticles().length, 1);
  const sitemap = fixture('@/app/sitemap').default();
  assert.equal(sitemap.length, 24, 'One published article adds 3 translations and 3 indexes');
  const metadataPage = fixture('@/app/[locale]/articles/[slug]/page');
  const records = catalog.getVisibleArticles();
  const titles = new Set(), descriptions = new Set();
  for (const article of records) {
    assert.ok(fs.existsSync(path.join(repo, 'public', article.image)));
    assert.ok(fs.statSync(path.join(repo, 'public', article.image)).size < 180000);
    for (const locale of ['ru', 'sr', 'en']) {
      const t = article.translations[locale];
      assert.ok(t.sections.length >= 4);
      assert.ok(!titles.has(t.title)); titles.add(t.title);
      assert.ok(!descriptions.has(t.description)); descriptions.add(t.description);
      const url = catalog.articlePath(article, locale);
      assert.match(url, /^\/(ru|sr|en)\/articles\/[a-z0-9-]+$/);
      if (article.id === 'regular-deep') {
        const metadata = await metadataPage.generateMetadata({params: Promise.resolve({locale, slug: t.slug})});
        assert.equal(metadata.robots.index, true);
        assert.equal(metadata.alternates.canonical, url);
        assert.equal(Object.keys(metadata.alternates.languages).length, 4);
        const entry = sitemap.find(s => s.url.endsWith(url));
        assert.ok(entry);
        for (const [lang, href] of Object.entries(metadata.alternates.languages)) assert.equal(entry.alternates.languages[lang], 'https://lumacleanrs.com' + href);
      }
    }
  }
  console.log(`PASS: draft isolation, production override, ${allCount * 3} translations, images, published metadata and sitemap fixture.`);
  const origin = process.argv[2];
  if (!origin) return;
  const mode = process.argv[3] || 'preview';
  const htmlCache = new Map();
  async function page(route) {
    if (!htmlCache.has(route)) htmlCache.set(route, (async () => {const r = await fetch(origin + route, {signal: AbortSignal.timeout(20000)}); return {status: r.status, html: await r.text(), headers: r.headers};})());
    return htmlCache.get(route);
  }
  const links = new Set();
  for (const locale of ['ru', 'sr', 'en']) {
    const index = await page('/' + locale + '/articles');
    assert.equal(index.status, 200);
    for (const article of records) {
      const t = article.translations[locale];
      const route = catalog.articlePath(article, locale);
      const result = await page(route);
      if (mode !== 'preview' && article.status === 'draft') {
        assert.equal(result.status, 404, route);
        assert.ok(!result.html.includes(t.lead), 'Draft body leaked: ' + route);
        assert.ok(!index.html.includes(t.title), 'Draft title leaked in index');
        continue;
      }
      assert.equal(result.status, 200, route);
      assert.match(result.html, new RegExp('<html[^>]+lang="' + locale + '"'));
      assert.equal((result.html.match(/<h1[\s>]/g) || []).length, 1);
      assert.ok(result.html.includes(t.lead.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;')), 'Server-rendered lead missing: ' + route);
      const schemas = [...result.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m => JSON.parse(m[1]));
      assert.ok(schemas.some(s => s['@graph']?.some(item => item['@type'] === 'Article')));
      assert.ok(schemas.some(s => s['@graph']?.some(item => item['@type'] === 'BreadcrumbList')));
      if (mode === 'preview') { assert.match(result.html, /name="robots" content="noindex/); assert.match(result.headers.get('x-robots-tag') || '', /noindex/); }
      if (mode !== 'preview') {
        assert.ok(result.html.includes('rel="canonical" href="https://lumacleanrs.com' + route + '"'), 'Self canonical mismatch: ' + route);
        assert.ok(!/noindex/i.test(result.headers.get('x-robots-tag') || ''), 'Noindex HTTP header: ' + route);
        assert.ok(!/name="robots" content="[^"]*noindex/.test(result.html));
        for (const [lang, href] of Object.entries(catalog.articleLanguages(article))) assert.ok(result.html.includes('hrefLang="' + lang + '" href="https://lumacleanrs.com' + href + '"'), 'Hreflang mismatch: ' + route + ' ' + lang);
      }
      for (const [, href] of result.html.matchAll(/<a\b[^>]*href="([^"<>]+)"/g)) if (href.startsWith('/') || href.startsWith('#')) links.add(href.startsWith('#') ? route + href : href);
      const image = await fetch(origin + article.image); assert.equal(image.status, 200);
    }
  }
  for (const href of links) {
    const [pathname, hash] = href.split('#');
    const result = await page(pathname);
    assert.equal(result.status, 200, 'Broken internal link: ' + href);
    if (hash) assert.ok(result.html.includes('id="' + hash + '"'), 'Missing anchor: ' + href);
  }
  const liveMap = await page('/sitemap.xml');
  assert.equal(liveMap.status, 200);
  assert.equal((liveMap.html.match(/<loc>/g) || []).length, expectedMapSize);
  for (const article of records) for (const locale of ['ru','sr','en']) assert.equal(liveMap.html.includes(catalog.articlePath(article,locale)), article.status === 'published', 'Sitemap visibility mismatch: ' + article.id);
  console.log(`PASS: ${mode} HTTP checks, ${allCount * 3} article URLs, 3 indexes, ${links.size} internal links and anchors, sitemap.`);
}
main().catch(error => {console.error(error); process.exitCode = 1;});
