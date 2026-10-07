import type { LegacyRow } from './legacy-import';
export type ImportProfile = 'generic' | 'lumaclean-2026';
const dates=['2026-07-23','2026-07-26','2026-07-31','2026-08-22','2026-09-10','2026-09-16','2026-09-18','2026-09-21','2026-09-25','2026-09-26','2026-09-29','2026-09-30','2026-10-02','2026-10-06'];
/** Owner-authorized source corrections; never a name-only CRM merge. Raw cells/hashes stay unchanged. */
export function applyHistoricalProfile(rows: LegacyRow[]) {
  const orders=rows.filter(r=>r.kind==='order'),expenses=rows.filter(r=>r.kind==='expense');
  const errors:string[]=[];
  if(orders.length!==14 || orders.some(r=>!/^([1-9]|1[0-4])$/.test(r.legacyId)) || new Set(orders.map(r=>r.legacyId)).size!==14) errors.push('BASELINE_MISMATCH: ожидаются ID заказов 1–14.');
  if(orders.reduce((s,r)=>s+(r.amount??0),0)!==155900)errors.push('BASELINE_MISMATCH: ожидаемая выручка 155900 RSD.');
  if(expenses.length!==4 || expenses.reduce((s,r)=>s+(r.amount??0),0)!==8806)errors.push('BASELINE_MISMATCH: ожидаются 4 расхода / 8806 RSD.');
  if(rows.some(r=>r.kind==='investment'))errors.push('BASELINE_MISMATCH: заполненных вложений не ожидается.');
  for(const r of orders){
    r.warnings=r.warnings.filter(w=>!w.startsWith('Старые расчётные выплаты'));
    if(r.legacyId==='3' && r.raw[0].value==='31.07.0206'){
      r.date='2026-07-31'; r.errors=r.errors.filter(e=>!e.startsWith('Подозрительная'));
      r.warnings.push('Дата исправлена по разрешённому правилу: 31.07.0206 → 31.07.2026; исходное значение сохранено.');
    }
    if(r.date!==dates[Number(r.legacyId)-1])errors.push('BASELINE_MISMATCH: дата заказа '+r.legacyId+' отличается от подтверждённой истории.');
    if(r.raw[3].value==='Дополнительная услуга'){
      r.service=null; r.historicalServiceLabel='Дополнительная услуга';
      r.errors=r.errors.filter(e=>!e.startsWith('Услуга отсутствует'));
    }
    for(const field of ['sourceVladislavPayout','sourcePartnerPayout']) {
      const value = r.legacyFinance?.[field];
      if(r.legacyId==='8' && field==='sourcePartnerPayout' && value===null && r.raw[12].value===0) {
        r.warnings.push('Выплата партнёру в заказе 8 пуста; исходное пустое значение сохранено, начисление не создаётся.');
      } else if(typeof value!=='number')r.errors.push('Отсутствует historical payout: '+field);
    }
    if(r.status!=='COMPLETED' || r.legacyFinance?.paymentReceived!=='Да')errors.push('BASELINE_MISMATCH: статус или оплата заказа '+r.legacyId+' отличаются.');
    r.legacyFinance={...r.legacyFinance,status:'SOURCE_CONFIRMED',sourceDateCorrected:r.date};
  }
  const yana=orders.filter(r=>['1','2','3'].includes(r.legacyId));
  const aliases=[...new Set(yana.map(r=>r.telegram).filter((v):v is string=>!!v))];
  const validYana=yana.length===3 && aliases.length===2 && yana.every(r=>r.name==='Яна'&&r.area===100&&!!r.telegram&&r.address===yana[0].address&&r.district===yana[0].district&&r.description===yana[0].description&&!!r.address);
  if(!validYana)errors.push('BASELINE_MISMATCH: доказательства source-объединения Яны отличаются.');
  else for(const r of yana){r.clientAliases=aliases;r.confirmedAliasKey='legacy-client:yana-jul-2026';r.warnings.push('Яна: два raw Telegram identifier объединены только внутри подтверждённого источника; актуальный handle не установлен.');}
  for(const r of expenses)if(r.raw[3].value===null||r.raw[3].value===''){r.category='OTHER';r.errors=r.errors.filter(e=>!e.startsWith('Категория расхода'));r.warnings.push('Пустая исходная категория → OTHER.');}
  for(const r of rows)r.errors.push(...errors);
  return errors;
}
