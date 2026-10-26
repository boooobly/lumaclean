import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';

test('actual analytics effect respects consent, records contact clicks, and excludes private URL values (mocked)', () => {
  const result = spawnSync(process.execPath, ['docs/seo-audit/check-attribution.mjs'], {encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /real analytics effect/);
});
