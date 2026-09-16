import {writeFileSync} from 'node:fs';

// Read-only HTTP checks; never submits leads or reads environment files.
// node docs/seo-audit/check-seo.mjs <origin> <output.json>
const origin = process.argv[2] || 'http://localhost:3100';
const canonicalOrigin = 'https://lumacleanrs.com';
const issues = [];
const check = (condition, message) => { if (!condition) issues.push(message); };
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
const attrs = (tag) => Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map((m) => [m[1].toLowerCase(), decode(m[2])]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'g'))].map((m) => attrs(m[0]));
const text = (s) => decode(s.replace(/<[^>]*>/g, '').trim());
async function get(path, headers = {}) {
  const response = await fetch(new URL(path, origin), {redirect: 'manual', headers, signal: AbortSignal.timeout(30000)});
  return {status: response.status, location: response.headers.get('location'), link: response.headers.get('link'), html: await response.text()};
}

const sitemap = await get('/sitemap.xml');
const entries = [...sitemap.html.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => ({
  url: m[1].match(/<loc>(.*?)<\/loc>/)?.[1],
  languages: Object.fromEntries(tags(m[1], 'xhtml:link').map((t) => [t.hreflang, t.href])),
}));
check(sitemap.status === 200 && entries.length === 18, 'Sitemap must contain 18 URLs and return 200');
const urls = new Set(entries.map((e) => e.url));
check(urls.size === 18, 'Duplicate sitemap URLs');
const pages = [];
for (const entry of entries) {
  const path = new URL(entry.url).pathname;
  const result = await get(path);
  const meta = tags(result.html, 'meta');
  const links = tags(result.html, 'link');
  const canonical = links.filter((l) => l.rel === 'canonical').map((l) => l.href);
  const languages = Object.fromEntries(links.filter((l) => l.hreflang).map((l) => [l.hreflang, l.href]));
  const h1 = [...result.html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => text(m[1]));
  const title = text(result.html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '');
  const description = meta.find((m) => m.name === 'description')?.content;
  const schemas = [...result.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const graph = schemas.flatMap((s) => s['@graph'] || [s]);
  const internalLinks = tags(result.html, 'a').map((a) => a.href).filter((href) => href?.startsWith('/'));
  const images = tags(result.html, 'img');
  check(result.status === 200, `${path}: status ${result.status}`);
  check(canonical.length === 1 && canonical[0] === entry.url, `${path}: canonical mismatch`);
  check(h1.length === 1, `${path}: expected one H1`);
  check(Boolean(title && description), `${path}: title/description missing`);
  check(!meta.some((m) => m.name === 'robots' && /noindex/.test(m.content)), `${path}: noindex`);
  check(result.html.match(/<html[^>]*lang="([^"]+)"/)?.[1] === path.split('/')[1], `${path}: lang mismatch`);
  check(images.every((i) => 'alt' in i), `${path}: missing alt attribute`);
  check(links.some((l) => l.rel === 'icon'), `${path}: favicon missing`);
  check(meta.some((m) => m.property === 'og:url' && m.content === entry.url), `${path}: og:url mismatch`);
  for (const field of ['og:title', 'og:description', 'og:image', 'og:locale']) check(meta.some((m) => m.property === field), `${path}: ${field} missing`);
  check(meta.some((m) => m.name === 'twitter:card' && m.content === 'summary_large_image'), `${path}: Twitter card missing`);
  for (const lang of ['sr', 'ru', 'en', 'x-default']) {
    check(languages[lang] === entry.languages[lang] && urls.has(languages[lang]), `${path}: invalid ${lang} alternate`);
    const target = entries.find((e) => e.url === languages[lang]);
    check(target?.languages[path.split('/')[1]] === entry.url, `${path}: non-reciprocal ${lang} alternate`);
  }
  if (result.link) for (const m of result.link.matchAll(/<([^>]+)>; rel="alternate"; hreflang="([^"]+)"/g)) {
    check(languages[m[2]] === m[1], `${path}: HTTP hreflang ${m[2]} conflicts with HTML (${m[1]})`);
  }
  const service = graph.find((s) => s['@type'] === 'Service');
  if (path.includes('/services/')) {
    check(Boolean(service && graph.some((s) => s['@type'] === 'BreadcrumbList')), `${path}: service/breadcrumb schema missing`);
    check(service?.url === entry.url, `${path}: Service URL mismatch`);
  } else check(graph.some((s) => s['@type'] === 'Organization'), `${path}: organization missing`);
  const faq = graph.find((s) => s['@type'] === 'FAQPage');
  check(Boolean(faq), `${path}: FAQ schema missing`);
  const visible = text(result.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''));
  for (const question of faq?.mainEntity || []) check(visible.includes(question.name) && visible.includes(question.acceptedAnswer.text), `${path}: FAQ not in server HTML`);
  for (const href of internalLinks) {
    const target = new URL(href, canonicalOrigin);
    check(urls.has(target.origin + target.pathname), `${path}: internal link outside sitemap ${href}`);
  }
  pages.push({path, status: result.status, title, description, h1, canonical, languages, httpLink: result.link, schemaTypes: graph.map((g) => g['@type']), internalLinks: [...new Set(internalLinks)], imageCount: images.length, emptyAltCount: images.filter((i) => i.alt === '').length, htmlBytes: Buffer.byteLength(result.html)});
}
check(new Set(pages.map((p) => p.title)).size === 18, 'Duplicate page titles');
check(new Set(pages.map((p) => p.description)).size === 18, 'Duplicate descriptions');
const checks = [];
for (const [path, expected] of [['/robots.txt',200],['/google5cb91d680e5bbb09.html',200],['/yandex_62602564e7246208.html',200],['/icon.svg',200],['/ru/',308],['/sr/',308],['/en/',308],['/ru/v2',308],['/sr/v2',308],['/en/v2',308],['/ru/services/not-a-service',404],['/sr/services/uborka-kvartir',404],['/en/services/ciscenje-stanova',404],['/ru/not-a-page',404],['/ru/de',404],['/missing-file.html',404]]) {
  const r = await get(path);
  check(r.status === expected, `${path}: expected ${expected}, got ${r.status}`);
  if (expected === 404) {
    check(r.html.includes('noindex'), `${path}: noindex missing`);
    check(!tags(r.html,'link').some((l) => l.rel === 'canonical'), `${path}: 404 inherits a canonical`);
    check(!tags(r.html,'meta').some((m) => m.name === 'robots' && /\bindex\b/.test(m.content)), `${path}: 404 inherits index directive`);
  }
  if (path === '/robots.txt') check(r.html.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`) && !r.html.includes('Disallow: /\n'), 'robots.txt incorrect');
  if (path.includes('google5')) check(r.html.trim() === 'google-site-verification: google5cb91d680e5bbb09.html', 'Google verification content incorrect');
  if (path.includes('yandex_')) check(r.html.includes('Verification: 62602564e7246208'), 'Yandex verification content incorrect');
  checks.push({path, status:r.status, location:r.location});
}
for (const locale of ['ru','sr','en']) {
  const r = await get('/', {'Accept-Language':locale});
  check(r.status === 307 && new URL(r.location,origin).pathname === `/${locale}`, `Root language redirect ${locale} incorrect`);
  checks.push({path:'/', language:locale, status:r.status, location:r.location});
}
const report = {checkedAt:new Date().toISOString(), origin, pages, checks, issues};
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({origin,pages:pages.length,checks:checks.length,issues},null,2));
if (issues.length) process.exitCode=1;
