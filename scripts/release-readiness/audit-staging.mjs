// Local PG18 only; credentials stay in ignored artifacts, never stdout or Git.
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import {isolatedEnvironment,localClusterDirectory} from './environment.mjs';
assert.equal(process.env.LUMACLEAN_LOCAL_PG18,'true');
const db=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/postgres'});await db.connect();
const directory=localClusterDirectory(),credentialPath='artifacts/audit-20261101/staging-credentials.json';
try{
 assert.equal((await db.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),directory.replaceAll('\\','/').toLowerCase());
 assert(Number((await db.query('SHOW server_version_num')).rows[0].server_version_num)>=180000);
 const existingDatabase=(await db.query("SELECT 1 FROM pg_database WHERE datname='lumaclean_staging_test' AND pg_get_userbyid(datdba)='lumaclean_staging_migrator'")).rowCount;
 if(existingDatabase){assert(process.argv.includes('--resume'),'Existing staging DB requires explicit resume');assert(existsSync(credentialPath));}
 else {
 assert(!existsSync(credentialPath),'Never overwrite credentials');
 const appPassword=randomBytes(32).toString('base64url'),migrationPassword=randomBytes(32).toString('base64url');
 await db.query("SET log_statement='none'");await db.query("SET log_min_error_statement='panic'");
 for(const [role,password] of [['lumaclean_staging_app',appPassword],['lumaclean_staging_migrator',migrationPassword]]){
  assert.equal((await db.query('SELECT 1 FROM pg_roles WHERE rolname=$1',[role])).rowCount,0,'Existing role is not disposable');
  await db.query(`CREATE ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD '${password}'`);
 }
 await db.query('CREATE DATABASE lumaclean_staging_test OWNER lumaclean_staging_migrator TEMPLATE template0');
 await db.query("ALTER DATABASE lumaclean_staging_test SET timezone='UTC'");
 writeFileSync(credentialPath,JSON.stringify({syntheticLocalOnly:true,appPassword,migrationPassword}));
 const hba=path.join(directory,'pg_hba.conf'),existing=readFileSync(hba,'utf8');
 const rules='host lumaclean_staging_test lumaclean_staging_app,lumaclean_staging_migrator 127.0.0.1/32 scram-sha-256\nhost all lumaclean_staging_app,lumaclean_staging_migrator 127.0.0.1/32 reject\n';
 writeFileSync(hba,rules+existing);assert.equal((await db.query('SELECT pg_reload_conf() ok')).rows[0].ok,true);
 }
}finally{await db.end();}
const env=isolatedEnvironment('lumaclean_staging_test',3108);env.__NEXT_PROCESSED_ENV='true';env.PATH=path.dirname(process.execPath)+path.delimiter+env.PATH;
for(const key of Object.keys(env))if(env[key]==='')delete env[key];
let log='';
const adminUrl=new URL(env.DATABASE_URL);adminUrl.username='postgres';adminUrl.password='';
const preflight=new pg.Client({connectionString:adminUrl.toString()});await preflight.connect();
try{const table=(await preflight.query("SELECT to_regclass('public.\"Client\"') AS table")).rows[0].table;if(table){const counts=(await preflight.query('SELECT (SELECT count(*) FROM "Client")::int clients,(SELECT count(*) FROM "Lead")::int leads,(SELECT count(*) FROM "Order")::int orders,(SELECT count(*) FROM "Message")::int messages')).rows[0];assert.deepEqual(counts,{clients:0,leads:0,orders:0,messages:0},'Never reseed a populated staging DB');}}finally{await preflight.end();}
for(const argv of [['node_modules/prisma/build/index.js','migrate','deploy'],['--import','tsx','prisma/seed.ts'],['--import','tsx','scripts/release-readiness/fixtures.ts']]){
 const r=spawnSync(process.execPath,argv,{env:{...env,DATABASE_URL:argv.at(-1).endsWith('fixtures.ts')?adminUrl.toString():env.DIRECT_URL},encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});log+=(r.stdout??'')+(r.stderr??'');writeFileSync('artifacts/audit-20261101/staging-setup.log',log);assert.equal(r.status,0,'Setup failed; inspect ignored log');
}
const admin=new pg.Client({connectionString:adminUrl.toString()});await admin.connect();
try{
 await admin.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');await admin.query('GRANT CONNECT ON DATABASE lumaclean_staging_test TO lumaclean_staging_app');await admin.query('GRANT USAGE ON SCHEMA public TO lumaclean_staging_app');
 await admin.query('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO lumaclean_staging_app');await admin.query('REVOKE ALL ON _prisma_migrations FROM lumaclean_staging_app');
 await admin.query('GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public TO lumaclean_staging_app');
 await admin.query('ALTER DEFAULT PRIVILEGES FOR ROLE lumaclean_staging_migrator IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO lumaclean_staging_app');
 await admin.query('ALTER DEFAULT PRIVILEGES FOR ROLE lumaclean_staging_migrator IN SCHEMA public GRANT USAGE,SELECT ON SEQUENCES TO lumaclean_staging_app');
 await admin.query(`UPDATE "BusinessSettings" SET "aiAgentMode"='OFF',"aiChannelModes"='{"WEBSITE":"OFF","TELEGRAM":"OFF","WHATSAPP":"OFF","VIBER":"OFF"}'::jsonb`);
}finally{await admin.end();}
const app=new pg.Client({connectionString:env.DATABASE_URL});await app.connect();
try{
 const identity=(await app.query("SELECT current_user role,current_database() database,inet_server_addr()::text host,inet_server_port() port,current_setting('server_version_num') version")).rows[0];
 assert.equal(identity.role,'lumaclean_staging_app');assert.equal(identity.database,'lumaclean_staging_test');
 const counts=(await app.query('SELECT (SELECT count(*) FROM "Client")::int clients,(SELECT count(*) FROM "Lead")::int leads,(SELECT count(*) FROM "Order")::int orders,(SELECT count(*) FROM "Message")::int messages')).rows[0];assert.deepEqual(counts,{clients:0,leads:0,orders:0,messages:0});
 await assert.rejects(app.query('CREATE TABLE public.forbidden_ddl(id int)'),e=>e.code==='42501');
 await assert.rejects(app.query('SELECT * FROM _prisma_migrations'),e=>e.code==='42501');
 const wrong=new URL(env.DATABASE_URL);wrong.password='wrong';const badPassword=new pg.Client({connectionString:wrong.toString()});await assert.rejects(badPassword.connect(),e=>e.code==='28P01');await badPassword.end();
 const foreign=new URL(env.DATABASE_URL);foreign.pathname='/lumaclean_ai_test';const badDatabase=new pg.Client({connectionString:foreign.toString()});await assert.rejects(badDatabase.connect(),e=>e.code==='28000');await badDatabase.end();
 const settings=(await app.query('SELECT "aiAgentMode","aiChannelModes" FROM "BusinessSettings"')).rows[0];assert.equal(settings.aiAgentMode,'OFF');
 const report={status:'PASS_LOCAL',identity,source:'empty PG18 + migrations + synthetic catalogue only',counts,settings,runtimeDdlDenied:true,migrationMetadataDenied:true,wrongPasswordDenied:true,otherDatabaseDenied:true,blobTokenConfigured:false,blobNamespace:env.CHAT_STORAGE_NAMESPACE,telegramConfigured:false,serverAI:false,remoteDeployment:'BLOCKED: dedicated bot/chat and Blob store/token absent; hosting operational confirmation required'};
 writeFileSync('docs/audit/evidence/staging-local.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await app.end();}
