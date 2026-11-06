// Summarize saved Lighthouse runs. No network, credentials or operational data.
import {readFile, writeFile, readdir} from 'node:fs/promises';
const root = 'artifacts/vercel-pro-20261101';
const median = values => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length ? sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2 : null;
};
const output = {kind: 'laboratory, API and third-party requests mocked', fieldCWV: null, phases: {}};
for (const phase of ['production-baseline', 'production-locales', 'local-before', 'local-after']) {
  const dir = `${root}/${phase}`;
  let files;
  try {files = (await readdir(dir)).filter(file => file.endsWith('.json') && file !== 'summary.json');}
  catch {continue;}
  const runs = [];
  for (const file of files) {
    const lhr = JSON.parse(await readFile(`${dir}/${file}`, 'utf8'));
    const audits = lhr.audits;
    const requests = audits['network-requests']?.details?.items ?? [];
    const values = type => requests.filter(item => item.resourceType === type);
    const sum = (rows, key) => rows.reduce((total, item) => total + (item[key] ?? 0), 0);
    runs.push({
      route: new URL(lhr.finalDisplayedUrl ?? lhr.finalUrl).pathname,
      device: lhr.configSettings.formFactor,
      lighthouse: lhr.lighthouseVersion,
      fetchTime: lhr.fetchTime,
      scores: Object.fromEntries(Object.entries(lhr.categories).map(([key, value]) => [key, value.score * 100])),
      fcpMs: audits['first-contentful-paint']?.numericValue,
      lcpMs: audits['largest-contentful-paint']?.numericValue,
      cls: audits['cumulative-layout-shift']?.numericValue,
      ttfbMs: audits['server-response-time']?.numericValue,
      tbtMs: audits['total-blocking-time']?.numericValue,
      transferBytes: audits['total-byte-weight']?.numericValue,
      requests: requests.length,
      scriptTransferBytes: sum(values('Script'), 'transferSize'),
      scriptDecodedBytes: sum(values('Script'), 'resourceSize'),
      imageTransferBytes: sum(values('Image'), 'transferSize'),
      fontTransferBytes: sum(values('Font'), 'transferSize'),
      unusedJavascriptBytes: audits['unused-javascript']?.details?.overallSavingsBytes ?? 0,
      lcpSelector: audits['lcp-breakdown-insight']?.details?.items?.find(item => item.type === 'node')?.selector ?? null,
    });
  }
  const groups = [];
  for (const route of [...new Set(runs.map(run => run.route))].sort()) for (const device of ['mobile', 'desktop']) {
    const selected = runs.filter(run => run.route === route && run.device === device);
    if (!selected.length) continue;
    const metrics = Object.fromEntries(['fcpMs', 'lcpMs', 'cls', 'ttfbMs', 'tbtMs', 'transferBytes', 'requests', 'scriptTransferBytes', 'scriptDecodedBytes', 'imageTransferBytes', 'fontTransferBytes', 'unusedJavascriptBytes'].map(key => [key, median(selected.map(run => run[key]))]));
    groups.push({route, device, runs: selected.length, performance: median(selected.map(run => run.scores.performance)), performanceRange: [Math.min(...selected.map(run => run.scores.performance)), Math.max(...selected.map(run => run.scores.performance))], ...metrics});
  }
  output.phases[phase] = {runs, medians: groups};
}
await writeFile('docs/vercel-pro-optimization-2026-11-evidence.json', JSON.stringify(output, null, 2) + '\n');
for (const phase of ['local-before', 'local-after']) console.log(phase, JSON.stringify(output.phases[phase]?.medians));
