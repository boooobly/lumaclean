/* eslint-disable @typescript-eslint/no-require-imports -- Local Node CommonJS runner. */
// Recreates only the named disposable local databases in our verification container.
const {spawnSync}=require('node:child_process');
const {mkdirSync,copyFileSync,writeFileSync}=require('node:fs');
const path=require('node:path');
function command(bin,args,env=process.env){const r=spawnSync(bin,args,{env,encoding:'utf8',windowsHide:true});if(r.status!==0)throw new Error(r.stderr || r.stdout);return r.stdout;}
const container='lumaclean-crm-verify';
const info=JSON.parse(command('docker',['inspect',container]))[0];
if(info.Name!==`/${container}` || info.NetworkSettings.Ports['5432/tcp'][0].HostIp!=='127.0.0.1' || info.NetworkSettings.Ports['5432/tcp'][0].HostPort!=='55439')throw Error('Use only the disposable loopback test container');
const prisma=require.resolve('prisma/build/index.js');
function environment(name){return {...process.env,DATABASE_URL:`postgresql://postgres@127.0.0.1:55439/${name}`,DIRECT_URL:`postgresql://postgres@127.0.0.1:55439/${name}`};}
for(const name of ['lumaclean_admin_test','lumaclean_admin_bootstrap_test','lumaclean_migration_test']){
 command('docker',['exec',container,'dropdb','-U','postgres','--if-exists','--force',name]);command('docker',['exec',container,'createdb','-U','postgres',name]);
}
const staging=path.resolve('artifacts/admin/foundation-migrations');mkdirSync(staging,{recursive:true});
for(const name of ['20261001090000_admin_foundation','20261001100000_audit_immutable']){mkdirSync(path.join(staging,name),{recursive:true});copyFileSync(`prisma/migrations/${name}/migration.sql`,path.join(staging,name,'migration.sql'));}
writeFileSync(path.join(staging,'migration_lock.toml'),'provider = "postgresql"\n');
const oldSchema=path.resolve('artifacts/admin/foundation.prisma');writeFileSync(oldSchema,command('git',['show','codex/admin-foundation:prisma/schema.prisma']));
const config=path.resolve('artifacts/admin/migration-old.config.ts');writeFileSync(config,`import {defineConfig} from "prisma/config"; export default defineConfig({schema:${JSON.stringify(oldSchema)},migrations:{path:${JSON.stringify(staging)}},datasource:{url:"postgresql://postgres@127.0.0.1:55439/lumaclean_migration_test"}});`);
command(process.execPath,[prisma,'migrate','deploy','--config',config],environment('lumaclean_migration_test'));
command(process.execPath,[require.resolve('tsx/cli'),'prisma/seed.ts'],environment('lumaclean_migration_test'));
const sql=`INSERT INTO "Client" ("id","name","phone","updatedAt") VALUES ('legacy-client','Migration fixture','0641234567',now());
INSERT INTO "ClientAddress" ("id","clientId","fullAddress","updatedAt") VALUES ('legacy-address','legacy-client','Migration fixture address',now());
INSERT INTO "Lead" ("id","name","phone","updatedAt") VALUES ('legacy-lead','Migration fixture','0641234567',now());
INSERT INTO "Order" ("id","clientId","addressId","serviceId","area","soilLevel","travelBufferMinutes","updatedAt") SELECT 'legacy-order','legacy-client','legacy-address',"id",55,'HEAVY',30,now() FROM "Service" WHERE "code"='regular';
UPDATE "Order" SET "scheduledStart"='2026-10-10T12:00Z',"estimatedDurationMinutes"=150 WHERE "id"='legacy-order';
INSERT INTO "Cleaner" ("id","name","phone","updatedAt") VALUES ('legacy-cleaner','Legacy cleaner','0641234567',now());
INSERT INTO "CleanerAvailability" ("id","cleanerId","kind","weekday","startMinute","endMinute","updatedAt") VALUES ('legacy-hours','legacy-cleaner','WEEKLY',6,540,1200,now());
INSERT INTO "OrderCleaner" ("id","orderId","cleanerId") VALUES ('legacy-assignment','legacy-order','legacy-cleaner');`;
command('docker',['exec',container,'psql','-U','postgres','-d','lumaclean_migration_test','-v','ON_ERROR_STOP=1','-c',sql]);
for(const name of ['lumaclean_admin_test','lumaclean_admin_bootstrap_test','lumaclean_migration_test']){
 command(process.execPath,[prisma,'migrate','deploy'],environment(name));
 const diff=command(process.execPath,[prisma,'migrate','diff','--from-config-datasource','--to-schema','prisma/schema.prisma','--exit-code'],environment(name));
 if(!diff.includes('No difference'))throw Error('Schema drift');
}
command(process.execPath,[require.resolve('tsx/cli'),'prisma/seed.ts'],environment('lumaclean_admin_test'));
const preserved=command('docker',['exec',container,'psql','-U','postgres','-d','lumaclean_migration_test','-t','-A','-c',`SELECT "soilLevel"::text || '|' || "reference" FROM "Order" WHERE "id"='legacy-order';`]);
if(preserved.trim()!=='HEAVY|ORD-LEGACY-legacy-order')throw Error('Legacy order was not preserved');
console.log('PASS: all five migrations, empty schema diff on three local databases, legacy soil/order/client/lead preserved. No remote databases accessed.');
