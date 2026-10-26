import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import type {PrismaClient} from '../../src/generated/prisma/client';
import {notifyWebsiteLead} from '../../src/lib/services/website-leads';
import {websiteLeadSchema} from '../../src/lib/validation/crm';

function routeHarness(failSave = false) {
  const calls: string[] = [], deferred: (() => Promise<void>)[] = [];
  const db = {};
  const modules: Record<string, unknown> = {
    'next/server': {NextResponse: Response, after: (fn: () => Promise<void>) => deferred.push(fn)},
    'node:crypto': {createHash: () => ({update: () => ({digest: () => 'synthetic-source'})})},
    '@/lib/database/client': {getDatabase: () => db},
    '@/lib/services/admin-http': {
      adminRateLimit: async () => {}, boundedBody: async (r: Request) => Buffer.from(await r.text()),
      financeError: () => Response.json({ok: false}, {status: 503}),
    },
    '@/lib/services/upholstery-leads': {saveUpholsteryLead: async () => {calls.push('save'); if (failSave) throw Error('storage unavailable'); return {id: 'mock-lead', reference: 'UP-MOCK'};}},
    '@/lib/agent/notifications': {publishNotifications: async () => calls.push('publish-all')},
    '@/lib/services/website-leads': {
      publishWebsiteLead: async (database: unknown, id: string) => {assert.equal(database, db); assert.equal(id, 'mock-lead'); calls.push('publish-one');},
      notifyWebsiteLead: async (database: unknown, lead: {id: string}) => {assert.equal(database, db); assert.equal(lead.id, 'mock-lead'); calls.push('recover');},
    },
  };
  const exports: {POST?: (r: Request) => Promise<Response>} = {};
  const code = ts.transpileModule(readFileSync('src/app/api/upholstery/lead/route.ts', 'utf8'), {compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}}).outputText;
  runInNewContext(code, {exports, require: (name: string) => {assert.ok(name in modules, `Unexpected dependency: ${name}`); return modules[name];}, console});
  return {calls, deferred, post: () => exports.POST!(new Request('http://localhost/api/upholstery/lead', {method: 'POST', headers: {'content-type': 'application/json'}, body: '{}'}))};
}

test('upholstery HTTP preserves the public response and schedules the same durable recovery as ordinary leads (mocked)', async () => {
  const h = routeHarness();
  const response = await h.post();
  assert.equal(response.status, 200);
  assert.deepEqual(h.calls, ['save', 'publish-one']);
  assert.deepEqual(await response.json(), {ok: true, result: {reference: 'UP-MOCK'}});
  assert.equal(h.deferred.length, 1);
  await h.deferred[0]();
  assert.deepEqual(h.calls, ['save', 'publish-one', 'recover']);
});

test('failed upholstery persistence never publishes or schedules a notification (mocked)', async () => {
  const h = routeHarness(true);
  assert.equal((await h.post()).status, 503);
  assert.deepEqual(h.calls, ['save']);
  assert.equal(h.deferred.length, 0);
});

for (const state of ['PENDING', 'UNKNOWN', 'DELIVERED'] as const) {
  test(`shared notification recovery: ${state}, no duplicate or uncertain Telegram retry (mocked)`, async () => {
    const calls: string[] = [];
    const db = {notification: {findUnique: async () => ({id: 'mock-event', deliveryState: state, publishedAt: null, lastErrorCode: 'QUEUE_UNAVAILABLE'})}} as unknown as PrismaClient;
    const input = websiteLeadSchema.parse({submissionId: '00000000-0000-4000-8000-000000000001', locale: 'ru', phone: '+381601234567', requestKind: 'CONTACT_REQUEST', consent: true});
    await notifyWebsiteLead(db, {id: 'mock-lead', reference: 'UP-MOCK'}, input, async () => assert.fail('Legacy direct send forbidden'), {
      publish: async () => {calls.push('publish');},
      deliver: async () => {calls.push('deliver');},
    } as Parameters<typeof notifyWebsiteLead>[4]);
    assert.deepEqual(calls, state === 'PENDING' ? ['publish', 'deliver'] : ['publish']);
  });
}
