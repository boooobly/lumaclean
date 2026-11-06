import assert from 'node:assert/strict';
import path from 'node:path';
import pg from 'pg';
const db=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/postgres'});
await db.connect();
try {
  const actual=(await db.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase();
  assert.equal(actual,path.resolve('artifacts/release-readiness/pgdata').replaceAll('\\','/').toLowerCase());
  for(const name of ['lumaclean_admin_test','lumaclean_admin_bootstrap_test','lumaclean_migration_test'])
    await db.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  console.log('Reset only the three named synthetic fixture databases in this checkout’s verified local cluster.');
} finally {await db.end();}
