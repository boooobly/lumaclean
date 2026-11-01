// Only the approved existing source defaults in a verified fresh synthetic local DB.
import assert from 'node:assert/strict';
import path from 'node:path';
import pg from 'pg';
import {upholsteryDefaults} from '../../src/lib/upholstery';
async function main(){
const url=new URL(process.env.DATABASE_URL!);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55461');assert.match(url.pathname,/^\/lumaclean_(admin|reliability)_test$/);
const db=new pg.Client({connectionString:url.toString()});await db.connect();
try{
 assert.equal((await db.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),path.resolve('artifacts/vercel-pro-20261101/pgdata').replaceAll('\\','/').toLowerCase());
 for(const table of ['Client','Lead','Order','Message'])assert.equal((await db.query(`SELECT count(*)::int n FROM "${table}"`)).rows[0].n,0,'Fresh synthetic DB required');
 await db.query('UPDATE "UpholsterySettings" SET catalog=$1::jsonb WHERE id=$2',[JSON.stringify(upholsteryDefaults),'default']);
}finally{await db.end();}
}
void main();
