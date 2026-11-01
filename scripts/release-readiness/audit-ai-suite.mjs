// Preserve each failed synthetic fixture. No DROP, remote connection, native call or deployment.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import {isolatedEnvironment,localClusterDirectory} from './environment.mjs';
assert.equal(process.env.LUMACLEAN_LOCAL_PG18,'true');
assert.equal(process.env.LUMACLEAN_SYNTHETIC_READINESS,'true');
const root='artifacts/audit-20261101';mkdirSync(root,{recursive:true});
const env=isolatedEnvironment('lumaclean_ai_test',3101);
env.PATH=path.dirname(process.execPath)+path.delimiter+env.PATH;env.__NEXT_PROCESSED_ENV='true';
for(const key of Object.keys(env))if(env[key]==='')delete env[key];
const control=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/postgres'});await control.connect();
let suffix;
try{
 assert.equal((await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),localClusterDirectory().replaceAll('\\','/').toLowerCase());
 assert(Number((await control.query('SHOW server_version_num')).rows[0].server_version_num)>=180000);
 assert.equal((await control.query("SELECT count(*)::int n FROM pg_stat_activity WHERE datname='lumaclean_ai_test'")).rows[0].n,0);
 suffix=Date.now().toString();
 if((await control.query("SELECT 1 FROM pg_database WHERE datname='lumaclean_ai_test'")).rowCount)await control.query(`ALTER DATABASE lumaclean_ai_test RENAME TO lumaclean_ai_before_${suffix}`);
 await control.query('CREATE DATABASE lumaclean_ai_test');await control.query("ALTER DATABASE lumaclean_ai_test SET timezone='UTC'");
}finally{await control.end();}
let setup='';
for(const argv of [['node_modules/prisma/build/index.js','migrate','deploy'],['--import','tsx','prisma/seed.ts'],['--import','tsx','scripts/release-readiness/fixtures.ts']]){
 const r=spawnSync(process.execPath,argv,{env,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});setup+=(r.stdout??'')+(r.stderr??'');
 writeFileSync(`${root}/ai-setup-${suffix}.log`,setup);assert.equal(r.status,0,'Synthetic setup failed');
}
Object.assign(env,{AI_TEST_DATABASE_URL:env.DATABASE_URL,AI_TEST_BASE_URL:'http://localhost:3101'});
const r=spawnSync(process.execPath,['--conditions=react-server','--import','tsx','--test','--test-concurrency=1','tests/agent/integration.test.ts'],{env,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024,timeout:120000});
const log=(r.stdout??'')+(r.stderr??'');writeFileSync(`${root}/ai-suite-${suffix}.log`,log);writeFileSync(`${root}/ai-suite-latest.log`,log);
const count=k=>Number([...log.matchAll(new RegExp('(?:ℹ |# )'+k+' (\\d+)','g'))].at(-1)?.[1]??0);
console.log(JSON.stringify({status:r.status,pass:count('pass'),fail:count('fail'),skip:count('skipped'),log:`${root}/ai-suite-${suffix}.log`,scope:'ISOLATED PostgreSQL 18 / MOCKED providers; not native/live',failures:log.split('\n').filter(l=>/^  ✖/.test(l)).map(l=>l.trim())}));
process.exitCode=r.status??1;
