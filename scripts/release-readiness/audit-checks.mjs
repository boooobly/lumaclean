// No dotenv, remote DB, provider calls, deployment or notification delivery.
import {spawnSync} from 'node:child_process';
import {mkdirSync,readdirSync,writeFileSync} from 'node:fs';
import {isolatedEnvironment} from './environment.mjs';
import path from 'node:path';
const action=process.argv[2]||'unit';
const env=isolatedEnvironment();
env.__NEXT_PROCESSED_ENV='true';
if(action==='unit') {delete env.LUMACLEAN_ROUTING_PROVIDER;delete env.LUMACLEAN_GOOGLE_ROUTING_ENABLED;}
env.PATH=path.dirname(process.execPath)+path.delimiter+env.PATH;
for(const key of Object.keys(env))if(env[key]==='')delete env[key];
const files=dir=>readdirSync(`tests/${dir}`).filter(f=>f.endsWith('.test.ts')).map(f=>`tests/${dir}/${f}`);
const commands={
 unit:['--conditions=react-server','--import','tsx','--test','--test-concurrency=1',...['admin','agent','crm','finance','reliability','routing','scheduling'].flatMap(files)],
 client:['--import','./tests/admin/ui-register.mjs','--require','./tests/register-client.cjs','--import','tsx','--test','tests/admin/messenger.test.tsx'],
 regression:['--conditions=react-server','--import','tsx','--test','tests/crm/final-rounding.test.ts'],
 lint:['node_modules/eslint/bin/eslint.js','.'],
 typecheck:['node_modules/next/dist/bin/next','typegen'],
 tsc:['node_modules/typescript/bin/tsc','--noEmit'],
 validate:['node_modules/prisma/build/index.js','validate'],
 build:['node_modules/next/dist/bin/next','build'],
};
if(!commands[action])throw Error('Unknown audit action');
mkdirSync('artifacts/audit-20261101',{recursive:true});
let setupLog='';
if(action==='build')for(const argv of [['scripts/copy-maplibre-worker.mjs'],['node_modules/prisma/build/index.js','generate']]){
 const step=spawnSync(process.execPath,argv,{env,encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});setupLog+=(step.stdout??'')+(step.stderr??'');
 if(step.status!==0){writeFileSync('artifacts/audit-20261101/build.log',setupLog);throw Error('Build preparation failed');}
}
const result=spawnSync(process.execPath,commands[action],{env,encoding:'utf8',windowsHide:true,maxBuffer:32*1024*1024});
writeFileSync(`artifacts/audit-20261101/${action}.log`,setupLog+(result.stdout??'')+(result.stderr??''));
console.log(JSON.stringify({action,node:process.version,status:result.status,error:result.error?.message,tail:((result.stdout??'')+(result.stderr??'')).slice(-2400)}));
process.exitCode=result.status??1;
