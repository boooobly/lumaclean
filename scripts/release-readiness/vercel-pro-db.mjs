// Fresh synthetic DBs on the dedicated PG18 cluster only. Preserve every earlier fixture.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {isolatedEnvironment} from './environment.mjs';
const target=process.argv[2];assert(['admin','reliability','recovery'].includes(target));
const name=target==='recovery'?'lumaclean_pro_recovery_test_v2':`lumaclean_${target}_test`;
const root=process.env.LUMACLEAN_VERIFICATION_SCOPE==='website-ai-20261102'?'artifacts/website-ai-activation-20261102/release-verification':'artifacts/vercel-pro-20261101/release-verification';mkdirSync(root,{recursive:true});
const env=isolatedEnvironment(target==='admin'?'lumaclean_admin_test':'lumaclean_reliability_test');
Object.assign(env,{DATABASE_URL:`postgresql://postgres@127.0.0.1:55461/${name}`,DIRECT_URL:`postgresql://postgres@127.0.0.1:55461/${name}`,__NEXT_PROCESSED_ENV:'true'});
env.PATH=path.dirname(process.execPath)+path.delimiter+env.PATH;
if(process.env.PRO_VERIFICATION_PRISMA_ENGINE)env.PRISMA_SCHEMA_ENGINE_BINARY=process.env.PRO_VERIFICATION_PRISMA_ENGINE;
const control=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55461/postgres'});await control.connect();
try{
 assert.equal((await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),path.resolve('artifacts/vercel-pro-20261101/pgdata').replaceAll('\\','/').toLowerCase());
 assert(Number((await control.query('SHOW server_version_num')).rows[0].server_version_num)>=180000);
 assert.equal((await control.query('SELECT count(*)::int n FROM pg_stat_activity WHERE datname=$1',[name])).rows[0].n,0,'Stop the test server first');
 if((await control.query('SELECT 1 FROM pg_database WHERE datname=$1',[name])).rowCount)await control.query(`ALTER DATABASE "${name}" RENAME TO "${name}_before_${Date.now()}"`);
 await control.query(`CREATE DATABASE "${name}"`);await control.query(`ALTER DATABASE "${name}" SET timezone='UTC'`);
}finally{await control.end();}
let log='';
for(const args of [['node_modules/prisma/build/index.js','migrate','deploy'],['node_modules/prisma/build/index.js','migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'],['--import','tsx','prisma/seed.ts']]){
 const r=spawnSync(process.execPath,args,{env,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});log+=(r.stdout??'')+(r.stderr??'');writeFileSync(`${root}/${target}-prepare.log`,log);assert.equal(r.status,0,'Preparation failed; see ignored log');
}
if(target!=='recovery'){
 const r=spawnSync(process.execPath,['--import','tsx','scripts/release-readiness/vercel-pro-catalog-fixture.ts'],{env,encoding:'utf8',windowsHide:true});
 log+=(r.stdout??'')+(r.stderr??'');writeFileSync(`${root}/${target}-prepare.log`,log);
 assert.equal(r.status,0,'Approved catalogue fixture failed');
}
const db=new pg.Client({connectionString:env.DATABASE_URL});await db.connect();
try{
 for(const table of ['Client','Lead','Order','Message'])assert.equal((await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n,0);
 // Test-only allowed-urgency fixture. Default cutoff rejection is covered separately.
 await db.query('UPDATE "BusinessSettings" SET "sameDayBookingCutoffMinute"=1439,"aiAgentMode"=\'OFF\',"aiChannelModes"=\'{"WEBSITE":"OFF","TELEGRAM":"OFF","WHATSAPP":"OFF","VIBER":"OFF"}\'::jsonb WHERE id=\'default\'');
}finally{await db.end();}
console.log(JSON.stringify({status:'PASS',scope:'fresh synthetic local PG18',host:'127.0.0.1',port:55461,database:name,migrations:25,productionAccess:false}));
