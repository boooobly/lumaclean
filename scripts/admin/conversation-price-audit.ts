import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {PrismaClient} from '../../src/generated/prisma/client';
import {PrismaPg} from '@prisma/adapter-pg';
import {pgConnectionString} from '../../src/lib/database/connection';
const scope=process.argv[2];
if(!['production-before','production-after','preview'].includes(scope))throw Error('SCOPE_REQUIRED');
process.loadEnvFile(scope==='preview'?'.env.preview.local':'.env.calendar-production.local');
const host=new URL(process.env.DATABASE_URL!).hostname;
if(!host.startsWith(scope==='preview'?'ep-wispy-river-b8xwqy9q':'ep-bitter-mode-b8r8ruag'))throw Error('DATABASE_SCOPE_MISMATCH');
const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(process.env.DATABASE_URL!),max:2})});
async function main(){try{
 const [catalog,orders,extras,audits,settings]=await Promise.all([
  db.serviceExtra.findMany({select:{code:true,unit:true,unitPrice:true,active:true},orderBy:{code:'asc'}}),
  db.order.findMany({select:{id:true,finalPrice:true,historical:true,priceAdjustment:true,discountAmount:true},orderBy:{id:'asc'}}),
  db.orderExtra.findMany({select:{id:true,quantity:true,unitPrice:true},orderBy:{id:'asc'}}),
  db.auditLog.groupBy({by:['action'],where:{entityType:'ServiceExtra'},_count:true}),
  db.businessSettings.findUniqueOrThrow({where:{id:'default'},select:{aiAgentMode:true,aiChannelModes:true}}),
 ]);
 const digest=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
 const out={at:new Date().toISOString(),scope,catalog:catalog.map(e=>({...e,unitPrice:Number(e.unitPrice)})),orderCount:orders.length,historicalOrderCount:orders.filter(o=>o.historical).length,orderFinancialDigest:digest(orders),orderExtraCount:extras.length,orderExtraDigest:digest(extras),catalogAuditCounts:audits.map(a=>({action:a.action,count:a._count})),modes:settings};
 writeFileSync(`qa-output/conversation-price-audit-${scope}.json`,JSON.stringify(out,null,2));console.log(JSON.stringify({scope,orders:orders.length,extras:extras.length,auditActions:audits.length}));
}finally{await db.$disconnect();}}
main().catch(()=>{console.error('READ_ONLY_PRICE_AUDIT_FAILED');process.exitCode=1;});
