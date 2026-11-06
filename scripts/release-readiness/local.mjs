import {spawn, spawnSync} from 'node:child_process';
import {mkdirSync, readFileSync, readdirSync, copyFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import pg from 'pg';
import {isolatedEnvironment} from './environment.mjs';
const require = createRequire(import.meta.url);
const [action, target = 'admin', ...args] = process.argv.slice(2);
const database = target === 'reliability' ? 'lumaclean_reliability_test' : target === 'ai' ? 'lumaclean_ai_test' : 'lumaclean_admin_test';
const port = target === 'reliability' ? 3106 : target === 'ai' ? 3101 : 3100;
const env = isolatedEnvironment(database, port);
if (target === 'unit') {
  env.LUMACLEAN_ROUTING_PROVIDER=''; env.LUMACLEAN_GOOGLE_ROUTING_ENABLED='';
  for (const key of Object.keys(env)) if (env[key] === '') delete env[key];
  env.__NEXT_PROCESSED_ENV='true';
}
function run(argv, childEnv = env) {
  const result = spawnSync(process.execPath, argv, {env: childEnv, stdio: 'inherit', windowsHide: true});
  if (result.status !== 0) throw Error(`Command failed (${result.status}): ${argv[0]}`);
}
if (action === 'prepare') {
  const controlUrl = new URL(env.DATABASE_URL); controlUrl.pathname = '/postgres';
  // Use postgres only on the dedicated local cluster, never a remote URL.
  const db = new pg.Client({connectionString: controlUrl.toString()});
  await db.connect();
  const actual = (await db.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\', '/').toLowerCase();
  const expected = path.resolve('artifacts/release-readiness/pgdata').replaceAll('\\', '/').toLowerCase();
  if (actual !== expected) throw Error('Wrong local PostgreSQL cluster');
  for (const name of ['lumaclean_admin_test','lumaclean_admin_bootstrap_test','lumaclean_migration_test','lumaclean_reliability_test','lumaclean_ai_test']) {
    if ((await db.query('SELECT 1 FROM pg_database WHERE datname=$1', [name])).rowCount) {
      if (target !== '--resume') throw Error(`Fresh database required: ${name}; no automatic DROP is permitted (use --resume only after an interrupted preparation)`);
    } else await db.query(`CREATE DATABASE "${name}"`);
    await db.query(`ALTER DATABASE "${name}" SET timezone = 'UTC'`);
  }
  await db.end();
  const prisma = require.resolve('prisma/build/index.js');
  for (const name of ['lumaclean_admin_test','lumaclean_admin_bootstrap_test','lumaclean_reliability_test','lumaclean_ai_test']) {
    const childEnv = isolatedEnvironment(name);
    run([prisma,'migrate','deploy'], childEnv);
    run([prisma,'migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'], childEnv);
    if (!name.includes('bootstrap')) {
      run([require.resolve('tsx/cli'),'prisma/seed.ts'], childEnv);
      run([require.resolve('tsx/cli'),'scripts/release-readiness/fixtures.ts'], childEnv);
    }
  }
  // Replay the foundation schema, insert synthetic old records, then apply every later migration.
  const staging = path.resolve('artifacts/release-readiness/foundation-migrations');
  mkdirSync(staging, {recursive:true});
  for (const name of readdirSync('prisma/migrations').filter(n => /^\d/.test(n) && n < '20261001120000')) {
    mkdirSync(path.join(staging,name), {recursive:true});
    copyFileSync(`prisma/migrations/${name}/migration.sql`,path.join(staging,name,'migration.sql'));
  }
  writeFileSync(path.join(staging,'migration_lock.toml'),'provider = "postgresql"\n');
  const config = path.resolve('artifacts/release-readiness/foundation.config.ts');
  writeFileSync(config, `import {defineConfig} from 'prisma/config'; export default defineConfig({schema:${JSON.stringify(path.resolve('prisma/schema.prisma'))},migrations:{path:${JSON.stringify(staging)}},datasource:{url:process.env.DATABASE_URL!}});`);
  const legacyEnv = isolatedEnvironment('lumaclean_migration_test');
  run([prisma,'migrate','deploy','--config',config], legacyEnv);
  const legacy = new pg.Client({connectionString:legacyEnv.DATABASE_URL}); await legacy.connect();
  // Reviewed fixture SQL from the existing loopback-only Docker runner.
  const original = readFileSync('scripts/admin/prepare-test-db.cjs','utf8');
  await legacy.query(`INSERT INTO "Service" (id,code,name,"updatedAt") VALUES ('foundation-regular','regular','Legacy synthetic fixture',now())`);
  const fixture = original.match(/const sql=`([\s\S]*?)`;/)?.[1];
  if (!fixture) throw Error('Legacy fixture missing');
  await legacy.query(fixture); await legacy.end();
  run([prisma,'migrate','deploy'], legacyEnv);
  run([prisma,'migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'], legacyEnv);
  console.log('PASS: dedicated cluster verified, 25 migrations on five databases, no drift; synthetic legacy fixtures preserved for regression tests.');
} else {
  let argv;
  if (action === 'server') argv = [require.resolve('next/dist/bin/next'),'start','--hostname',target === 'admin' ? 'localhost' : '127.0.0.1','--port',String(port)];
  else if (action === 'test') {
    for (const key of Object.keys(env)) if (env[key] === '') delete env[key];
    env.__NEXT_PROCESSED_ENV = 'true';
    if (target === 'reliability') Object.assign(env,{RELIABILITY_TEST_DATABASE_URL:env.DATABASE_URL,RELIABILITY_TEST_BASE_URL:`http://127.0.0.1:${port}`});
    else if (target === 'ai') Object.assign(env,{AI_TEST_DATABASE_URL:env.DATABASE_URL,AI_TEST_BASE_URL:`http://localhost:${port}`});
    else Object.assign(env,{ADMIN_TEST_DATABASE_URL:env.DATABASE_URL,ADMIN_TEST_BASE_URL:`http://localhost:${port}`});
    argv = ['--conditions=react-server','--import','tsx','--test','--test-concurrency=1',...args];
  } else if (action === 'exec') argv = args;
  else throw Error('Use prepare | server admin/reliability/ai | test target files... | exec target node-arguments...');
  const child = spawn(process.execPath,argv,{env,stdio:'inherit',windowsHide:true});
  process.on('SIGINT',()=>child.kill());
  child.on('exit',code=>process.exitCode=code??1);
}
