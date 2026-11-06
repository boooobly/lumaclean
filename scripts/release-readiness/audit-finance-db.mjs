import assert from 'node:assert/strict';
import path from 'node:path';
import pg from 'pg';
import {spawnSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {isolatedEnvironment,localClusterDirectory} from './environment.mjs';
const env=isolatedEnvironment();env.__NEXT_PROCESSED_ENV='true';env.PATH=path.dirname(process.execPath)+path.delimiter+env.PATH;
const db=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/postgres'});await db.connect();
try {
 const actual=(await db.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase();
 assert.equal(actual,localClusterDirectory().replaceAll('\\','/').toLowerCase());
 const name='lumaclean_admin_test',backup=name+'_before_finance_'+Date.now();
 assert.equal((await db.query('SELECT 1 FROM pg_database WHERE datname=$1',[backup])).rowCount,0);
 assert.equal((await db.query('SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=$1',[name])).rows[0].n,0,'Wait for local test connections to close');
 await db.query(`ALTER DATABASE "${name}" RENAME TO "${backup}"`);
 await db.query(`CREATE DATABASE "${name}"`);
} finally {await db.end();}
let log='';
for(const argv of [['node_modules/prisma/build/index.js','migrate','deploy'],['--import','tsx','prisma/seed.ts'],['--import','tsx','scripts/release-readiness/fixtures.ts']]) {
 const r=spawnSync(process.execPath,argv,{env,encoding:'utf8',windowsHide:true});log+=(r.stdout??'')+(r.stderr??'');
 if(r.status!==0){writeFileSync('artifacts/audit-20261101/finance-prepare.log',log);throw Error('Finance fixture preparation failed');}
}
writeFileSync('artifacts/audit-20261101/finance-prepare.log',log);console.log('Fresh synthetic finance database prepared; preceding admin fixture preserved.');
