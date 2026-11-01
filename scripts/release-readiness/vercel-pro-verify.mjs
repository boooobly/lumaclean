// Reproducible local-only verification. Never loads live dotenv values or sends native traffic.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {existsSync,mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import {isolatedEnvironment} from './environment.mjs';
const [action='unit',target='admin',...args]=process.argv.slice(2);
assert(['admin','reliability','recovery'].includes(target));
const root='artifacts/vercel-pro-20261101/release-verification';mkdirSync(root,{recursive:true});
const database=target==='recovery'?'lumaclean_pro_recovery_test_v2':`lumaclean_${target}_test`;
const port=target==='admin'?3128:target==='reliability'?3129:3130;
const env=isolatedEnvironment(target==='admin'?'lumaclean_admin_test':'lumaclean_reliability_test',port);
Object.assign(env,{DATABASE_URL:`postgresql://postgres@127.0.0.1:55461/${database}`,DIRECT_URL:`postgresql://postgres@127.0.0.1:55461/${database}`,CRON_SECRET:'synthetic-pro-cron-local-only',__NEXT_PROCESSED_ENV:'true'});
env.PATH=path.dirname(process.execPath)+path.delimiter+env.PATH;
// Reuse the installed engine without touching the user-wide read-only Prisma cache.
const engine=process.env.PRO_VERIFICATION_PRISMA_ENGINE??path.resolve('node_modules/@prisma/engines/schema-engine-windows.exe');
if(process.platform==='win32'&&existsSync(engine))env.PRISMA_SCHEMA_ENGINE_BINARY=engine;
if(target!=='admin')env.BETTER_AUTH_URL=`http://127.0.0.1:${port}`;
assert.equal(env.AI_AGENT_ENABLED,'false');
for(const key of Object.keys(env))if(/(?:TOKEN|API_KEY)/.test(key))assert(!env[key],`Unexpected external credential: ${key}`);
const files=dir=>readdirSync(`tests/${dir}`).filter(f=>f.endsWith('.test.ts')).map(f=>`tests/${dir}/${f}`);
const commands={unit:['--conditions=react-server','--import','tsx','--test','--test-concurrency=1',...['admin','agent','crm','finance','reliability','routing','scheduling'].flatMap(files)],
 client:['--import','./tests/admin/ui-register.mjs','--require','./tests/register-client.cjs','--import','tsx','--test','tests/admin/messenger.test.tsx'],
 lint:['node_modules/eslint/bin/eslint.js','.'],types:['node_modules/next/dist/bin/next','typegen'],tsc:['node_modules/typescript/bin/tsc','--noEmit'],
 validate:['node_modules/prisma/build/index.js','validate'],build:['node_modules/next/dist/bin/next','build']};
if(action==='unit'){
 delete env.LUMACLEAN_ROUTING_PROVIDER;delete env.LUMACLEAN_GOOGLE_ROUTING_ENABLED;
 // Unit fixtures restore unset flags; an empty inherited flag changes their semantics.
 // Next dotenv remains disabled via __NEXT_PROCESSED_ENV.
 for(const key of Object.keys(env))if(env[key]==='')delete env[key];
}
if(action==='test'||action==='server'){
 const db=new pg.Client({connectionString:env.DATABASE_URL});await db.connect();
 try{
  const i=(await db.query('SELECT current_database() AS db,current_setting($1) AS dir,current_setting($2)::int AS version',['data_directory','server_version_num'])).rows[0];
  assert.equal(i.db,database);assert.equal(i.dir.replaceAll('\\','/').toLowerCase(),path.resolve('artifacts/vercel-pro-20261101/pgdata').replaceAll('\\','/').toLowerCase());assert(i.version>=180000);
 }finally{await db.end();}
 if(action==='test')Object.assign(env,target==='recovery'?{PRO_RECOVERY_TEST_DATABASE_URL:env.DATABASE_URL}:target==='admin'?{ADMIN_TEST_DATABASE_URL:env.DATABASE_URL,ADMIN_TEST_BASE_URL:`http://localhost:${port}`}:{RELIABILITY_TEST_DATABASE_URL:env.DATABASE_URL,RELIABILITY_TEST_BASE_URL:`http://127.0.0.1:${port}`});
 const argv=action==='server'?['node_modules/next/dist/bin/next','start','-H',target==='admin'?'localhost':'127.0.0.1','-p',String(port)]:['--conditions=react-server','--import','tsx','--test','--test-concurrency=1',...args];
 if(action==='server'){
  const child=spawn(process.execPath,argv,{env,stdio:'inherit',windowsHide:true});process.on('SIGINT',()=>child.kill());child.on('exit',code=>process.exitCode=code??1);
 }else{
  const r=spawnSync(process.execPath,argv,{env,encoding:'utf8',windowsHide:true,maxBuffer:16*1024*1024});
  writeFileSync(`${root}/${target}.log`,(r.stdout??'')+(r.stderr??''));console.log((r.stdout??'').slice(-1700));process.exitCode=r.status??1;
 }
}else{
 assert(commands[action],`Unknown action: ${action}`);
 let setup='';
 if(action==='build')for(const a of [['scripts/copy-maplibre-worker.mjs'],['node_modules/prisma/build/index.js','generate']]){
  const r=spawnSync(process.execPath,a,{env,encoding:'utf8',windowsHide:true});setup+=(r.stdout??'')+(r.stderr??'');writeFileSync(`${root}/build-prepare.log`,setup);assert.equal(r.status,0,'Build preparation failed; see ignored build-prepare.log');
 }
 const r=spawnSync(process.execPath,commands[action],{env,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
 writeFileSync(`${root}/${action}.log`,setup+(r.stdout??'')+(r.stderr??''));
 console.log(JSON.stringify({action,status:r.status,tail:((r.stdout??'')+(r.stderr??'')).slice(-1700)}));process.exitCode=r.status??1;
}
