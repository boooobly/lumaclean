// Current approved catalogue in disposable local databases only. Never production.
import assert from 'node:assert/strict';
import path from 'node:path';
import pg from 'pg';
import {upholsteryDefaults} from '../../src/lib/upholstery';
async function main() {
const target = new URL(process.env.DATABASE_URL!);
assert.equal(target.hostname,'127.0.0.1'); assert.equal(target.port,'55449');
assert.match(target.pathname,/^\/lumaclean_(admin|reliability|ai)_test$/);
const db = new pg.Client({connectionString:target.toString()}); await db.connect();
try {
  const actual=(await db.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase();
  assert.equal(actual,path.resolve('artifacts/release-readiness/pgdata').replaceAll('\\','/').toLowerCase());
  await db.query('UPDATE "UpholsterySettings" SET catalog=$1::jsonb WHERE id=$2',[JSON.stringify(upholsteryDefaults),'default']);
  console.log('PASS: approved upholstery catalogue installed in the verified disposable local fixture');
} finally {await db.end();}
}
void main();
