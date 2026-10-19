import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import test from 'node:test';
import {Client} from 'pg';
import {randomUUID} from 'node:crypto';
const url=process.env.RELIABILITY_TEST_DATABASE_URL;
test('ordered release migrations preserve legacy Lead and Order snapshots and permit genuine contacts',{skip:!url},async()=>{
  const target=new URL(url!);assert.equal(target.hostname,'127.0.0.1');assert.equal(target.pathname,'/lumaclean_reliability_test');
  const root=new Client({connectionString:url});await root.connect();
  const name='lumaclean_rc_migration_'+randomUUID().replaceAll('-','');
  assert.match(name,/^lumaclean_rc_migration_[a-f0-9]{32}$/);
  await root.query(`CREATE DATABASE "${name}"`);
  target.pathname='/'+name;
  const db=new Client({connectionString:target.toString()});await db.connect();
  try{
    const migrations=readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)).sort();
    const release=migrations.filter(n=>n>='20261018190000');
    for(const name of migrations.filter(n=>!release.includes(n)))await db.query(readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));
    await db.query(`INSERT INTO "Service" (id,code,name,"updatedAt") VALUES ('fixture-service','regular','Synthetic',now());
      INSERT INTO "Client" (id,name,"updatedAt") VALUES ('fixture-client','Synthetic',now());
      INSERT INTO "ClientAddress" (id,"clientId","fullAddress","updatedAt") VALUES ('fixture-address','fixture-client','Synthetic address',now());
      INSERT INTO "Lead" (id,name,phone,"updatedAt") VALUES ('fixture-legacy','Legacy name','synthetic',now());
      INSERT INTO "Order" (id,"clientId","addressId","serviceId",area,"travelBufferMinutes","basePrice","finalPrice","updatedAt") VALUES ('fixture-order','fixture-client','fixture-address','fixture-service',55,10,6000,6000,now());`);
    const snapshot=async()=>({lead:(await db.query(`SELECT row_to_json(t) value FROM "Lead" t WHERE id='fixture-legacy'`)).rows,order:(await db.query('SELECT row_to_json(t) value FROM "Order" t')).rows});
    const before=await snapshot();
    for(const name of release)await db.query(readFileSync(`prisma/migrations/${name}/migration.sql`,'utf8'));
    assert.deepEqual(await snapshot(),before);
    await db.query(`INSERT INTO "Lead" (id,phone,"requestKind","updatedAt") VALUES ('fixture-contact','synthetic','CONTACT_REQUEST',now()),('fixture-no-name','synthetic','CLEANING',now());
      INSERT INTO "Notification" (id,"eventKey",kind,audience,channel,text,"scheduledAt",payload) VALUES ('fixture-notification','website-lead:fixture-contact:telegram','WEBSITE_LEAD','ADMIN','TELEGRAM','Synthetic',now(),'{"leadId":"fixture-contact"}');`);
    const contact=(await db.query(`SELECT name,"serviceId",area,"estimatedPrice" FROM "Lead" WHERE id='fixture-contact'`)).rows[0];
    assert.deepEqual(contact,{name:null,serviceId:null,area:null,estimatedPrice:null});
    assert.equal((await db.query('SELECT count(*)::int n FROM "Order"')).rows[0].n,1);
  }finally{await db.end();await root.query(`DROP DATABASE "${name}"`);await root.end();}
});
