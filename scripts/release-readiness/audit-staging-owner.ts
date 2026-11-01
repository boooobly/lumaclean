// Synthetic local admin only. Password stays in ignored artifacts.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,writeFileSync} from 'node:fs';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {hashPassword} from 'better-auth/crypto';
import {PrismaClient} from '../../src/generated/prisma/client';
import {isolatedEnvironment,localClusterDirectory} from './environment.mjs';
async function main(){
 const env=isolatedEnvironment('lumaclean_staging_test',3108),file='artifacts/audit-20261101/staging-owner.json';assert(!existsSync(file));
 const control=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/postgres'});await control.connect();
 try{assert.equal((await control.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),localClusterDirectory().replaceAll('\\','/').toLowerCase());}finally{await control.end();}
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:env.DATABASE_URL,max:2})});
 try{assert.equal(await db.user.count(),0);assert.equal(await db.client.count(),0);const id=randomUUID(),email=`staging-${id}@example.test`,password=randomUUID()+'Aa!7';await db.user.create({data:{id,name:'Synthetic staging owner',email,emailVerified:true,role:'ADMIN',accounts:{create:{accountId:id,providerId:'credential',password:await hashPassword(password)}}}});writeFileSync(file,JSON.stringify({syntheticLocalOnly:true,email,password}));console.log(JSON.stringify({created:true,scope:'local synthetic admin; credentials not printed'}));}finally{await db.$disconnect();}
}
void main();
