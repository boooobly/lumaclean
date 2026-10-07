import test from 'node:test';
import assert from 'node:assert/strict';
import {legacyFixture} from './fixtures';
import {parseLegacyWorkbook} from '../../src/lib/domain/legacy-import';
import {clientSchema,websiteLeadSchema} from '../../src/lib/validation/crm';
import {financePeriod} from '../../src/lib/domain/finance';
import {completedPeriodWhere} from '../../src/lib/services/finance-calculation';
import {adminAddressSearchQueries,normalizeAddress,signLocation} from '../../src/lib/services/google-places';
function history(){
 const book=legacyFixture(), sheet=book.getWorksheet('Заказы')!;
 const dates=['23.07.2026','26.07.2026','31.07.0206','22.08.2026','10.09.2026','16.09.2026','18.09.2026','21.09.2026','25.09.2026','26.09.2026','29.09.2026','30.09.2026','02.10.2026','06.10.2026'];
 for(let id=1;id<=14;id++)sheet.getRow(id+4).values=[dates[id-1],id,id<=3 ? `Яна @synthetic_alias00${id===3?8:7}` : [7,8,9,11,13,14].includes(id) ? 'Synthetic repeat @synthetic_repeat' : `Synthetic ${id} @synthetic_${id}`,id===8?'Дополнительная услуга':'Поддерживающая уборка',100,'Белград',id===14?25900:10000,0,.15,1500,8500,46144,3,4250,id===8?null:4250,'Выполнен','Да',id<=3?'Адрес Synthetic street 10':'Source comment  '];
 const expense=book.getWorksheet('Расходы')!;
 for(let id=1;id<=4;id++)expense.getRow(id+4).values=['22.07.2026',id,id===1?1:null,id===4?null:'Прочее','Unchanged description','Synthetic payer',id===4?5806:1000,'Да','Source expense comment'];
 sheet.getRow(12).getCell(13).value=0;
 return book;
}
test('confirmed profile preserves 14 date-only orders, source comments, alias evidence and separate expense ledger',()=>{
 const preview=parseLegacyWorkbook(history(),'lumaclean-2026');assert.equal(preview.summary.blocked,0);assert.equal(preview.summary.clients,7);assert.equal(preview.summary.orders,14);assert.equal(preview.summary.expenses,4);assert.equal(preview.summary.investments,0);
 const orders=preview.rows.filter(r=>r.kind==='order');assert.equal(orders.reduce((s,r)=>s+r.amount!,0),155900);assert.equal(preview.rows.filter(r=>r.kind==='expense').reduce((s,r)=>s+r.amount!,0),8806);
 assert.equal(new Set(orders.slice(0,3).map(r=>r.clientKey)).size,1);assert.deepEqual(orders[0].clientAliases,['@synthetic_alias007','@synthetic_alias008']);assert.equal(orders[2].raw[0].value,'31.07.0206');assert.equal(orders[2].date,'2026-07-31');assert.equal(orders[3].description,'Source comment  ');assert.equal(orders[3].phone,null);assert.equal(orders[7].service,null);assert.equal(orders[7].historicalServiceLabel,'Дополнительная услуга');assert.equal(orders[7].legacyFinance?.sourcePartnerPayout,null);assert.equal(preview.rows.at(-1)?.category,'OTHER');
});
test('profile stops every row on baseline, date, payment, or identity-evidence mismatch',()=>{
 for(const change of [(b:ReturnType<typeof history>)=>{b.getWorksheet('Заказы')!.getCell('G5').value=10001;},(b:ReturnType<typeof history>)=>{b.getWorksheet('Заказы')!.getCell('A5').value='24.07.2026';},(b:ReturnType<typeof history>)=>{b.getWorksheet('Заказы')!.getCell('Q5').value='Нет';},(b:ReturnType<typeof history>)=>{b.getWorksheet('Заказы')!.getCell('R7').value='Адрес Different street 11';}]){const b=history();change(b);const p=parseLegacyWorkbook(b,'lumaclean-2026');assert(p.baselineErrors?.length);assert(p.rows.every(r=>r.errors.length));}
});
test('generic import never applies the owner-specific correction or merges two aliases',()=>{
 const p=parseLegacyWorkbook(history());assert.equal(p.rows.find(r=>r.legacyId==='3')?.date,null);assert(p.summary.blocked>0);
});
test('CRM accepts missing phone while public contact validation still requires phone',()=>{
 const client=clientSchema.parse({name:'Synthetic contact',phone:'',telegram:'@synthetic'});assert.equal(client.phone,null);assert.equal(clientSchema.parse({name:'Synthetic contact',phone:null}).phone,null);assert.equal(websiteLeadSchema.safeParse({name:'Synthetic contact',phone:''}).success,false);
});
test('finance date-only bounds use Belgrade calendar dates even across DST',()=>{
 const period=financePeriod({period:'custom',from:'2026-10-01',to:'2026-10-31'});const where=completedPeriodWhere(period);assert.deepEqual(where.OR?.[0],{historicalServiceDate:{gte:new Date('2026-10-01T00:00:00Z'),lt:new Date('2026-11-01T00:00:00Z')}});
});
test('admin address search normalizes NFC and Serbian variants without modifying saved text',()=>{
 const text='Luke Ćelovića Trebinjca 34';assert.deepEqual(adminAddressSearchQueries(text),[text,'Luke Celovica Trebinjca 34']);assert.deepEqual(adminAddressSearchQueries('Đorđa'),['Đorđa','Djordja','Dorda']);assert.equal(adminAddressSearchQueries('C\u0301elovica')[0],'Ćelovica');assert.equal(normalizeAddress({fullAddress:text}).fullAddress,text);
});
test('manual text clears coordinates and only signed Admin map proof confirms a location',()=>{
 const old=process.env.BETTER_AUTH_SECRET;process.env.BETTER_AUTH_SECRET='synthetic-hmac-test-secret';
 try{const fullAddress='Luke Ćelovića Trebinjca 34';assert.deepEqual(normalizeAddress({fullAddress,textOnly:true},{fullAddress}),{fullAddress,coordinatesConfirmed:false,coordinatesSource:'MANUAL_TEXT',latitude:null,longitude:null,placeId:null});const proof=signLocation({address:fullAddress,placeId:'user-confirmed:synthetic',latitude:44.81,longitude:20.46,expires:Date.now()+10000});const saved=normalizeAddress({fullAddress,locationProof:proof});assert("coordinatesSource" in saved);assert("coordinatesConfirmed" in saved);assert.equal(saved.coordinatesSource,'MANUAL_ADMIN_MAP');assert.equal(saved.coordinatesConfirmed,true);assert.throws(()=>normalizeAddress({fullAddress,locationProof:proof+'broken'}));assert.throws(()=>normalizeAddress({fullAddress:fullAddress+', Beograd',locationProof:proof}));}finally{process.env.BETTER_AUTH_SECRET=old;}
});
