// Synthetic loopback PostgreSQL 18 only. Never reads a production backup or drops a database.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {localClusterDirectory} from './environment.mjs';
assert.equal(process.env.LUMACLEAN_LOCAL_PG18,'true');
const root='artifacts/audit-20261101',bin=path.resolve(root,'pg18-runtime/unpacked/pgsql/bin');
const sourceName='lumaclean_ai_test',targetName='lumaclean_restore_'+Date.now();
const url=name=>'postgresql://postgres@127.0.0.1:55449/'+name;
const source=new pg.Client({connectionString:url(sourceName)});await source.connect();
let target;
function native(name,args){const r=spawnSync(path.join(bin,name+(process.platform==='win32'?'.exe':'')),args,{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024});writeFileSync(`${root}/${name}-rehearsal.log`,(r.stdout??'')+(r.stderr??''));assert.equal(r.status,0,name+' failed; inspect ignored log');}
async function hashes(db){
 await db.query("SET TIME ZONE 'UTC'");
 const tables=(await db.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
 const rows=[];
 for(const {tablename} of tables){assert(/^[A-Za-z_][A-Za-z0-9_]*$/.test(tablename));const r=(await db.query(`SELECT count(*)::int AS count,md5(coalesce(string_agg(to_jsonb(t)::text,'|' ORDER BY to_jsonb(t)::text),'')) AS hash FROM public."${tablename}" t`)).rows[0];rows.push({table:tablename,...r});}
 return rows;
}
try{
 assert.equal((await source.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),localClusterDirectory().replaceAll('\\','/').toLowerCase());
 assert(Number((await source.query('SHOW server_version_num')).rows[0].server_version_num)>=180000);
 const initial=await hashes(source);assert(initial.find(r=>r.table==='Order').count>0,'Booking fixtures required');
 const archive=path.resolve(root,'synthetic-backup-'+Date.now()+'.dump');const start=Date.now();
 native('pg_dump',['--format=custom','--no-owner','--no-privileges','--file',archive,'--dbname',url(sourceName)]);
 await source.query(`CREATE DATABASE "${targetName}" TEMPLATE template0`);
 native('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-privileges','--dbname',url(targetName),archive]);
 target=new pg.Client({connectionString:url(targetName)});await target.connect();
 const restored=await hashes(target);assert.deepEqual(restored,initial,'Restored rows/snapshots differ');
 const sql=readFileSync('docs/audit/evidence/schema-objects.sql','utf8');const expected=JSON.parse(readFileSync('docs/audit/evidence/production-schema-objects.json'));
 const objects=(await target.query(sql)).rows;assert.deepEqual(objects,expected,'Restored schema objects differ');
 const history=(await target.query('SELECT migration_name,checksum FROM _prisma_migrations ORDER BY migration_name')).rows;
 assert.deepEqual(history,JSON.parse(readFileSync('docs/audit/evidence/deployed-migrations.json')));
 await target.query('BEGIN');let immutable=false;
 try{await target.query('UPDATE "AuditLog" SET action=action');}catch(e){assert.equal(e.code,'P0001');immutable=true;}finally{await target.query('ROLLBACK');}
 assert(immutable,'Audit immutability trigger missing after restore');
 const report={status:'PASS',scope:'Synthetic full backup/restore; not proof of production backup recoverability',host:'127.0.0.1',port:55449,postgres:'18.6',sourceDatabase:sourceName,targetDatabase:targetName,tables:restored.length,rowsEqual:true,schemaObjects:objects.length,migrationChecksums:history.length,auditImmutable:true,elapsedSeconds:Math.round((Date.now()-start)/1000),archiveSha256:createHash('sha256').update(readFileSync(archive)).digest('hex'),productionAccess:false};
 writeFileSync('docs/audit/evidence/backup-rehearsal.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await target?.end();await source.end();}
