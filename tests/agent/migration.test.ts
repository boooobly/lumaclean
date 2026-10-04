import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {Client} from 'pg';
import test from 'node:test';
const url=process.env.AI_TEST_DATABASE_URL;
test('additive AI migration preserves finance-era CRM and conversation history',{skip:!url},async()=>{
  const parsed=new URL(url!);assert.equal(parsed.hostname,'127.0.0.1');assert.equal(parsed.port,'55439');assert.equal(parsed.pathname,'/lumaclean_ai_test');
  const name='lumaclean_ai_migration_'+randomUUID().replaceAll('-','');const control=new Client({connectionString:url});await control.connect();await control.query(`CREATE DATABASE ${name}`);await control.end();parsed.pathname='/'+name;
  const db=new Client({connectionString:parsed.toString()});await db.connect();
  try{
    const target='20261001210000_admin_ai_agent';for(const d of readdirSync('prisma/migrations').filter(d=>/^\d/.test(d)&&d<target).sort())await db.query(readFileSync(`prisma/migrations/${d}/migration.sql`,'utf8'));
    await db.query(`INSERT INTO "BusinessSettings" (id,"updatedAt") VALUES ('default',now()) ON CONFLICT (id) DO NOTHING; INSERT INTO "Conversation" (id,channel,"updatedAt") VALUES ('legacy-dialog','WEBSITE',now()); INSERT INTO "Message" (id,"conversationId",author,text) VALUES ('legacy-message','legacy-dialog','CLIENT','Preserve history'); INSERT INTO "Client" (id,name,phone,"updatedAt") VALUES ('legacy-client','Synthetic','0641234567',now()); INSERT INTO "ClientAddress" (id,"clientId","fullAddress","updatedAt") VALUES ('legacy-address','legacy-client','Synthetic',now()); INSERT INTO "Service" (id,code,name,"updatedAt") VALUES ('legacy-service','regular','Synthetic',now()); INSERT INTO "Order" (id,"clientId","addressId","serviceId",area,"basePrice","finalPrice","travelBufferMinutes","updatedAt") VALUES ('legacy-order','legacy-client','legacy-address','legacy-service',60,5700,5700,30,now());`);
    const before=(await db.query('SELECT * FROM "Order"')).rows;await db.query(readFileSync(`prisma/migrations/${target}/migration.sql`,'utf8'));assert.deepEqual((await db.query('SELECT * FROM "Order"')).rows,before);
    assert.equal((await db.query('SELECT text FROM "Message" WHERE id=\'legacy-message\'')).rows[0].text,'Preserve history');assert.equal((await db.query('SELECT "aiAgentMode" FROM "BusinessSettings"')).rows[0].aiAgentMode,'SHADOW');assert.equal((await db.query('SELECT control FROM "Conversation"')).rows[0].control,'AI_CONTROL');assert.equal((await db.query('SELECT count(*)::int AS n FROM "AgentSlot"')).rows[0].n,0);
    await db.query(`UPDATE "Conversation" SET "shadowProposal"='{"text":"Legacy suggestion","plan":[]}' WHERE id='legacy-dialog'; INSERT INTO "Notification" (id,"clientId",channel,text,"scheduledAt") VALUES ('legacy-notification','legacy-client','WEBSITE','Preserve notification',now());`);
    const oldNotification=(await db.query('SELECT * FROM "Notification"')).rows[0];
    await db.query(readFileSync('prisma/migrations/20261001220000_ai_go_live/migration.sql','utf8'));
    assert.deepEqual((await db.query('SELECT * FROM "Order"')).rows,before);
    const newNotification=(await db.query('SELECT * FROM "Notification"')).rows[0];
    for(const key of Object.keys(oldNotification))assert.deepEqual(newNotification[key],oldNotification[key]);
    assert.equal(newNotification.deliveryState,'LEGACY');
    assert.equal((await db.query('SELECT "aiChannelModes" FROM "BusinessSettings"')).rows[0].aiChannelModes.TELEGRAM,'OFF');
    assert.equal((await db.query('SELECT snapshot FROM "ShadowSuggestion"')).rows[0].snapshot.text,'Legacy suggestion');
    assert.equal((await db.query('SELECT "aiAgentMode" FROM "BusinessSettings"')).rows[0].aiAgentMode,'SHADOW');
  }finally{await db.end();}
});
