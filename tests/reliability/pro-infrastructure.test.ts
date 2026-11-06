import assert from 'node:assert/strict';
import test from 'node:test';
import {Pool} from 'pg';
import type {PrismaClient} from '../../src/generated/prisma/client';
import {getDatabase} from '../../src/lib/database/client';
import {recoverWebsiteLeadNotifications} from '../../src/lib/services/website-notification-recovery';

test('empty website recovery batch performs no delivery',async()=>{
  const db={$queryRaw:async()=>[]} as unknown as PrismaClient;
  const result=await recoverWebsiteLeadNotifications(db,async()=>assert.fail('No delivery for an empty batch'),()=>100000);
  assert.equal(result.selected,0);assert.equal(result.errors,0);
});

test('database lookup failure is propagated without a delivery attempt',async()=>{
  const db={$queryRaw:async()=>{throw Error('synthetic outage');}} as unknown as PrismaClient;
  await assert.rejects(recoverWebsiteLeadNotifications(db,async()=>assert.fail('No send during DB outage')),/synthetic outage/);
});

test('idle PostgreSQL error is handled without contacts or connection details in logs',async()=>{
  const globals=globalThis as unknown as {lumaDatabase?:PrismaClient};
  assert.equal(globals.lumaDatabase,undefined,'Fresh unit process required');
  const originalUrl=process.env.DATABASE_URL,originalOn=Pool.prototype.on,originalError=console.error;
  const messages:string[]=[],pools:Pool[]=[];
  process.env.DATABASE_URL='postgresql://synthetic@127.0.0.1:55461/lumaclean_admin_test';
  Pool.prototype.on=function(...args:Parameters<Pool['on']>){pools.push(this);return originalOn.apply(this,args);};
  console.error=(message:unknown)=>{messages.push(String(message));};
  try{
    const client=getDatabase();assert.equal(getDatabase(),client);
    const pool=pools[0];assert(pool);assert.equal(pool.options.max,3);assert.equal(pool.options.idleTimeoutMillis,10000);assert.equal(pool.options.connectionTimeoutMillis,5000);
    assert.equal(pool.emit('error',Error('synthetic secret/contact/connection URL must not be logged')),true);
    assert.deepEqual(messages,[JSON.stringify({msg:'database_idle_connection_failed'})]);
    await client.$disconnect();
  }finally{
    delete globals.lumaDatabase;Pool.prototype.on=originalOn;console.error=originalError;
    if(originalUrl===undefined)delete process.env.DATABASE_URL;else process.env.DATABASE_URL=originalUrl;
    if(pools[0]&&!pools[0].ended)await pools[0].end();
  }
});
