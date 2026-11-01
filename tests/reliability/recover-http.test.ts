import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
const base=process.env.RELIABILITY_TEST_BASE_URL,url=process.env.RELIABILITY_TEST_DATABASE_URL;
test('actual recovery HTTP authenticates cron, reclaims OFF work and preserves UNKNOWN sends',{skip:!base||!url},async()=>{
 assert.equal(new URL(base!).origin,'http://127.0.0.1:3106');assert.equal(new URL(url!).hostname,'127.0.0.1');assert.equal(new URL(url!).pathname,'/lumaclean_reliability_test');
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:url!,max:2})});
 try{
  assert.equal((await fetch(base+'/api/agent/recover')).status,401);
  assert.equal((await fetch(base+'/api/agent/recover',{headers:{Authorization:'Bearer é'}})).status,401);
  const conversation=await db.conversation.create({data:{channel:'WEBSITE'}}),message=await db.message.create({data:{conversationId:conversation.id,author:'CLIENT',text:'Synthetic recovery input',deliveryStatus:'DELIVERED'}});
  const owner=await db.user.create({data:{name:'Synthetic recovery owner',email:`recovery-${randomUUID()}@example.test`,role:'ADMIN',emailVerified:true}});
  const job=await db.agentJob.create({data:{conversationId:conversation.id,messageId:message.id,status:'RUNNING',leaseKey:randomUUID(),leaseUntil:new Date(0),createdAt:new Date(0)}});
  const expired=await db.notification.create({data:{eventKey:randomUUID(),userId:owner.id,audience:'ADMIN',kind:'BOOKED',channel:'WEBSITE',text:'Synthetic expired lease',scheduledAt:new Date(0),deliveryState:'SENDING',leaseKey:randomUUID(),leaseUntil:new Date(0)}});
  const pending=await db.notification.create({data:{eventKey:randomUUID(),userId:owner.id,audience:'ADMIN',kind:'BOOKED',channel:'WEBSITE',text:'Synthetic internal notice',scheduledAt:new Date(0),nextAttemptAt:new Date(0),deliveryState:'PENDING'}});
  const modelCalls=await db.aIInvocation.count();
  const request=()=>fetch(base+'/api/agent/recover',{headers:{Authorization:'Bearer '+process.env.CRON_SECRET}});
  const response=await request();assert.equal(response.status,200);assert.match(response.headers.get('cache-control')??'',/no-store/);
  assert.equal((await db.agentJob.findUniqueOrThrow({where:{id:job.id}})).status,'DONE');
  assert.equal((await db.notification.findUniqueOrThrow({where:{id:expired.id}})).deliveryState,'UNKNOWN');
  assert.equal((await db.notification.findUniqueOrThrow({where:{id:pending.id}})).deliveryState,'INTERNAL');
  assert.equal((await request()).status,200);assert.equal((await db.notification.findUniqueOrThrow({where:{id:expired.id}})).deliveryState,'UNKNOWN');assert.equal(await db.aIInvocation.count(),modelCalls);
 }finally{await db.$disconnect();}
});
