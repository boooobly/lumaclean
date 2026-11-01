// Preserve existing synthetic fixtures; never connect to a remote database.
import assert from 'node:assert/strict';
import path from 'node:path';
import pg from 'pg';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {isolatedEnvironment} from './environment.mjs';
const env=isolatedEnvironment();env.__NEXT_PROCESSED_ENV='true';
const control=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/postgres'});
await control.connect();
try {
  const directory=(await control.query('SHOW data_directory')).rows[0].data_directory;
  assert.equal(directory.replaceAll('\\','/').toLowerCase(),path.resolve('artifacts/release-readiness/pgdata').replaceAll('\\','/').toLowerCase());
  for(const name of ['lumaclean_admin_test','lumaclean_admin_bootstrap_test','lumaclean_migration_test','lumaclean_reliability_test','lumaclean_ai_test']) {
    assert.equal((await control.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[name])).rows[0].n,0);
    const backup=name+'_before_audit_20261101';
    assert.equal((await control.query('SELECT 1 FROM pg_database WHERE datname=$1',[backup])).rowCount,0,'Never overwrite an earlier audit backup');
    if((await control.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await control.query(`ALTER DATABASE "${name}" RENAME TO "${backup}"`);
  }
} finally {await control.end();}
env.PATH=path.dirname(process.execPath)+';'+env.PATH;
const result=spawnSync(process.execPath,['scripts/release-readiness/local.mjs','prepare'],{env,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
writeFileSync('artifacts/audit-20261101/database-prepare.log',(result.stdout??'')+(result.stderr??''));
console.log(JSON.stringify({status:result.status,tail:((result.stdout??'')+(result.stderr??'')).slice(-1800)}));
process.exitCode=result.status??1;
