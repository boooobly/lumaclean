// Uses the existing ImportBatch/ImportRecord service. Source and detailed reports remain private.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {Workbook} from 'exceljs';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../../src/generated/prisma/client';
import {pgConnectionString} from '../../src/lib/database/connection';
import {parseLegacyWorkbook} from '../../src/lib/domain/legacy-import';
import {previewLegacy,applyLegacy} from '../../src/lib/services/legacy-import';
import {periodTotals} from '../../src/lib/services/finance-calculation';
import {financePeriod} from '../../src/lib/domain/finance';
const [action='source',sourcePath='artifacts/historical-source.xlsx',target='preview']=process.argv.slice(2);
const bytes=readFileSync(sourcePath);
async function main(){
 const book=new Workbook();await book.xlsx.load(bytes as unknown as Parameters<typeof book.xlsx.load>[0]);
 const source=parseLegacyWorkbook(book,'lumaclean-2026');
 assert.equal(source.rows.length,18);assert.equal(source.summary.clients,7);assert.equal(source.summary.blocked,0,JSON.stringify(source.rows.filter(r=>r.errors.length).map(r=>({id:r.legacyId,errors:r.errors}))));
 const orders=source.rows.filter(r=>r.kind==='order'),expenses=source.rows.filter(r=>r.kind==='expense');
 const sums={orders:orders.length,revenue:orders.reduce((s,r)=>s+r.amount!,0),expenses:expenses.length,expenseTotal:expenses.reduce((s,r)=>s+r.amount!,0),payouts:orders.flatMap(r=>[r.legacyFinance?.sourceVladislavPayout,r.legacyFinance?.sourcePartnerPayout]).filter(v=>Number(v)>0).length,payoutTotal:orders.reduce((s,r)=>s+Number(r.legacyFinance?.sourceVladislavPayout??0)+Number(r.legacyFinance?.sourcePartnerPayout??0),0),clients:source.summary.clients,investments:source.summary.investments};
 assert.deepEqual(sums,{orders:14,revenue:155900,expenses:4,expenseTotal:8806,payouts:27,payoutTotal:125400.5,clients:7,investments:0});
 assert.equal(new Set(orders.slice(0,3).map(r=>r.clientKey)).size,1);
 assert.equal(orders.filter(r=>r.clientKey===orders[6].clientKey).length,6);
 assert.equal(orders[2].date,'2026-07-31');assert.equal(orders[2].raw[0].value,'31.07.0206');
 assert.equal(orders[6].description,String(orders[6].raw[17].value));
 assert.equal(orders[7].service,null);assert.equal(orders[7].historicalServiceLabel,'Дополнительная услуга');
 assert(orders.filter(r=>r.telegram&&!r.phone).length===12);
 const report:Record<string,unknown>={source:sums,sourceChecks:'PASS',fileHash:source.fileHash,corrections:['31.07.0206 → 2026-07-31'],warnings:[...new Set(source.rows.flatMap(r=>r.warnings))]};
 if(action==='source'){writeFileSync('artifacts/historical-source-reconciliation.json',JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status??'SOURCE_PASS',source:report.source,imported:report.imported,months:report.months,secondRun:report.secondRun ? Object.fromEntries(Object.entries(report.secondRun as object).filter(([key])=>key!=='warnings')) : undefined}));return;}
 const url=process.env.DATABASE_URL!;const host=new URL(url).hostname;
 assert(target==='preview' ? host.startsWith('ep-wispy-river-b8xwqy9q') : target==='production'&&host.startsWith('ep-bitter-mode-b8r8ruag'),'Explicit environment guard');
 const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(url),max:3})});
 try{
 const counts=async()=>({clients:await db.client.count(),addresses:await db.clientAddress.count(),orders:await db.order.count(),expenses:await db.expense.count(),payouts:await db.cleanerPayout.count(),investments:await db.investment.count(),notifications:await db.notification.count(),invocations:await db.aIInvocation.count(),jobs:await db.agentJob.count()});
 const before=await counts();
 const modes=await db.businessSettings.findUniqueOrThrow({where:{id:'default'},select:{aiAgentMode:true,aiChannelModes:true}});
 const owner=await db.user.findFirstOrThrow({where:{role:'ADMIN',active:true},orderBy:{createdAt:'asc'},select:{id:true}});
 if(action==='preview'||action==='apply'){
 const preview=await previewLegacy(db,owner.id,bytes,'LumaClean — доходы, расходы и выплаты.xlsx','lumaclean-2026');
 writeFileSync(`artifacts/historical-${target}-preview.json`,JSON.stringify(preview,null,2));
 assert.equal(preview.summary.blocked,0,'Identity or changed-source collision');
 report.before=before;report.modes=modes;report.preview={batchId:preview.batchId,summary:preview.summary,existingClients:new Set(preview.rows.map(r=>r.clientId).filter(Boolean)).size};
 writeFileSync(`artifacts/historical-${target}-baseline.json`,JSON.stringify(report,null,2));
 if(action==='preview'){console.log(JSON.stringify({status:report.status??'SOURCE_PASS',source:report.source,imported:report.imported,months:report.months,secondRun:report.secondRun ? Object.fromEntries(Object.entries(report.secondRun as object).filter(([key])=>key!=='warnings')) : undefined}));return;}
 const payload={batchId:preview.batchId,selected:preview.rows.map(r=>r.sourceKey),resolutions:[],acknowledgeWarnings:true,reason:'Owner-authorized historical workbook migration; deterministic source and Preview reconciliation passed.'};
 report.result=await applyLegacy(db,owner.id,payload);
 const afterFirst=await counts();
 report.secondRun=await applyLegacy(db,owner.id,payload);
 if(target==='preview')assert.deepEqual(await counts(),afterFirst,'Second run duplicates or side effects');
 const result2=report.secondRun as {clients:number;orders:number;expenses:number;payouts:number;investments:number;addresses:number;skipped:number};
 assert.equal(result2.clients+result2.orders+result2.expenses+result2.payouts+result2.investments+result2.addresses,0);assert.equal(result2.skipped,18);
 if(target==='preview'){assert.equal(afterFirst.notifications,before.notifications);assert.equal(afterFirst.invocations,before.invocations);assert.equal(afterFirst.jobs,before.jobs);}
 }
 const records=await db.importRecord.findMany({where:{sourceKey:{in:source.rows.map(r=>r.sourceKey)}}});assert.equal(records.length,18);
 const ids=records.filter(r=>r.entityType==='Order').map(r=>r.entityId);
 const imported=await db.order.findMany({where:{id:{in:ids}},include:{client:true,address:true,payouts:true}});
 assert.equal(imported.length,14);assert.equal(new Set(imported.map(o=>o.clientId)).size,7);
 for(const o of imported){const row=orders.find(r=>r.legacyId===o.legacyId)!;assert(o.historical);assert.equal(o.status,'COMPLETED');assert.equal(o.source,'MANUAL');assert.equal(o.historicalServiceDate?.toISOString().slice(0,10),row.date);assert.equal(o.completedAt,null);assert.equal(o.scheduledStart,null);assert.equal(o.windowFrom,null);assert.equal(o.windowTo,null);assert.equal(o.estimatedDurationMinutes,null);assert.equal(Number(o.finalPrice),row.amount);assert.equal(o.internalComment,row.description||null);assert.deepEqual(o.legacyFinance,{...row.legacyFinance,sourceWorkbook:'LumaClean — доходы, расходы и выплаты.xlsx'});assert.equal(o.address.coordinatesConfirmed,false);assert.equal(o.address.latitude,null);if(!row.phone && o.client.legacyImportKey===row.clientKey)assert.equal(o.client.phone,null);for(const p of o.payouts){assert(p.historical);assert.equal(p.status,'PAID');assert.equal(p.appliedPercent,null);assert.equal(p.basisAmount,null);assert.equal(p.paidAt,null);assert.equal(Number(p.amount),Number(row.legacyFinance?.[p.recipientName==='Владислав'?'sourceVladislavPayout':'sourcePartnerPayout']));if(p.recipientName==='Партнёр')assert.equal(p.cleanerId,null);}}
 const importedExpenses=await db.expense.findMany({where:{id:{in:records.filter(r=>r.entityType==='Expense').map(r=>r.entityId)}}});
 for(const e of importedExpenses){const row=expenses.find(r=>records.find(i=>i.entityId===e.id)?.sourceKey===r.sourceKey)!;assert.equal(Number(e.amount),row.amount);assert.equal(e.description,row.description);assert.equal(e.payoutId,null);assert.equal(e.deletedAt,null);}
 const totals=await db.$transaction(tx=>periodTotals(tx,financePeriod({period:'custom',from:'2026-07-01',to:'2026-10-31'})));
 assert.equal(await db.notification.count({where:{orderId:{in:ids}}}),0,'Historical orders cannot emit notifications');
 const payouts=imported.flatMap(o=>o.payouts);
 const actual={orders:imported.length,revenue:imported.reduce((s,o)=>s+Number(o.finalPrice),0),expenses:importedExpenses.length,expenseTotal:importedExpenses.reduce((s,e)=>s+Number(e.amount),0),payouts:payouts.length,payoutTotal:payouts.reduce((s,p)=>s+Number(p.amount),0),clients:new Set(imported.map(o=>o.clientId)).size,investments:0};
 assert.deepEqual(actual,sums);report.imported=actual;report.financePeriod=totals;
 report.months=['2026-07','2026-08','2026-09','2026-10'].map(month=>({month,orders:imported.filter(o=>o.historicalServiceDate?.toISOString().startsWith(month)).length,revenue:imported.filter(o=>o.historicalServiceDate?.toISOString().startsWith(month)).reduce((s,o)=>s+Number(o.finalPrice),0)}));
 assert.deepEqual(await db.businessSettings.findUniqueOrThrow({where:{id:'default'},select:{aiAgentMode:true,aiChannelModes:true}}),modes);
 report.after=await counts();report.status='PASS';writeFileSync(`artifacts/historical-${target}-reconciliation.json`,JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status??'SOURCE_PASS',source:report.source,imported:report.imported,months:report.months,secondRun:report.secondRun ? Object.fromEntries(Object.entries(report.secondRun as object).filter(([key])=>key!=='warnings')) : undefined}));
 }finally{await db.$disconnect();}
}
main().catch(e=>{console.error(e instanceof Error ? e.message : 'Historical audit failed');process.exitCode=1;});
