// Local-only negative tests: no valid leads, Queue wakes or notifications.
import assert from 'node:assert/strict';
import {mkdir, writeFile} from 'node:fs/promises';
const base = process.env.PRO_HTTP_TEST_URL;
assert.ok(base && ['localhost', '127.0.0.1'].includes(new URL(base).hostname), 'Use an isolated local test server');
const cases = [
  ['/api/notifications/recover', {}, 401],
  ['/api/notifications/recover', {headers: {authorization: 'Bearer wrong'}}, 401],
  ['/api/agent/recover', {}, 401],
  ['/api/agent/recover', {headers: {authorization: 'Bearer wrong'}}, 401],
  ['/api/admin/clients', {}, 401],
  ['/api/lead', {method: 'POST', body: '{}'}, 400],
  ['/api/lead', {method: 'POST', body: 'x'.repeat(16001)}, 413],
  ['/api/queues/notifications', {method: 'POST', body: '{}'}, 400],
  ['/api/queues/agent', {method: 'POST', body: '{}'}, 400],
];
const rows = [];
for (const [path, options, status] of cases) {
  const response = await fetch(base + path, {...options, redirect: 'manual', signal: AbortSignal.timeout(10000)});
  assert.equal(response.status, status, path);
  const cacheControl = response.headers.get('cache-control');
  assert.ok(cacheControl?.includes('no-store'), `${path}: ${cacheControl}`);
  rows.push({path, method: options.method ?? 'GET', status, cacheControl});
  await response.arrayBuffer();
}
await mkdir('artifacts/vercel-pro-20261101', {recursive: true});
await writeFile('artifacts/vercel-pro-20261101/http-security.json', JSON.stringify({base, rows, status: 'PASS'}, null, 2));
console.log(`PASS ${rows.length} local HTTP security/cache checks`);
