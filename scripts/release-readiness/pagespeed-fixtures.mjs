// Preserve old synthetic databases, then prepare clean manual-release fixtures.
// No production URL, credentials, migration deployment or notification delivery.
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import pg from 'pg';
import {isolatedEnvironment} from './environment.mjs';
const require=createRequire(import.meta.url);
const phase=process.argv[2]||'initial';
assert.ok(['initial','finance','admin-final'].includes(phase));
const runtime=path.resolve('../lumaclean-release-candidate/artifacts/release-readiness/runtime/pgsql/bin');
const control=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/postgres'});
await control.connect();
try{
 const dir=(await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase();
 assert.equal(dir,path.resolve('artifacts/release-readiness/pgdata').replaceAll('\\','/').toLowerCase());
 for(const name of phase==='finance'?['lumaclean_admin_test']:['lumaclean_admin_test','lumaclean_admin_bootstrap_test']){
  const backup=name+'_before_20261031'+(phase==='initial'?'':'_'+phase.replace('-','_'));
  assert.equal((await control.query('SELECT 1 FROM pg_database WHERE datname=$1',[backup])).rowCount,0,'Existing backup: do not overwrite');
  assert.equal((await control.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[name])).rows[0].n,0,'Stop the fixture server before preparation');
  await control.query(`ALTER DATABASE "${name}" RENAME TO "${backup}"`);
  await control.query(`CREATE DATABASE "${name}"`);
  const restored=spawnSync(path.join(runtime,'psql.exe'),['-h','127.0.0.1','-p','55449','-U','postgres','-d',name,'-v','ON_ERROR_STOP=1','-f','artifacts/production-release-2026-10-31/test-schema.sql'],{stdio:'inherit',windowsHide:true});
  assert.equal(restored.status,0,'Schema restore failed');
 }
 const env=isolatedEnvironment('lumaclean_admin_test');env.__NEXT_PROCESSED_ENV='true';
 const seeded=spawnSync(process.execPath,[require.resolve('tsx/cli'),'prisma/seed.ts'],{env,stdio:'inherit',windowsHide:true});assert.equal(seeded.status,0);
 const db=new pg.Client({connectionString:env.DATABASE_URL});await db.connect();
 try{
  const previous=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/lumaclean_admin_test_before_20261031'});await previous.connect();
  try{
   // These defaults were migration INSERTs, not schema. Restore only the
   // configuration rows; operational records and auth users stay absent.
   const up=(await previous.query('SELECT row_to_json(t) AS value FROM "UpholsterySettings" t')).rows;
   for(const row of up)await db.query('INSERT INTO "UpholsterySettings" SELECT * FROM json_populate_record(NULL::"UpholsterySettings",$1::json)',[JSON.stringify(row.value)]);
   const services=(await previous.query('SELECT row_to_json(t) AS value FROM "Service" t WHERE code=$1',['upholstery'])).rows;
   for(const row of services)await db.query('INSERT INTO "Service" SELECT * FROM json_populate_record(NULL::"Service",$1::json)',[JSON.stringify(row.value)]);
  }finally{await previous.end();}
  // This fixture deliberately tests an allowed urgent request at any ordinary
  // hour. Actual cutoff rejection has separate temporal/reliability tests.
  await db.query('UPDATE "BusinessSettings" SET "sameDayBookingCutoffMinute"=1439 WHERE id=$1',['default']);
  for(const table of ['Order','Lead','Client','Expense'])assert.equal((await db.query(`SELECT count(*)::int AS n FROM "${table}"`)).rows[0].n,0);
 }finally{await db.end();}
 console.log('PASS: prior disposable databases retained under *_before_20261031; clean schema restored and synthetic catalogue seeded, no migrations deployed');
}finally{await control.end();}
