// Read source rows only. This CLI never writes operational or import tables.
import { readFileSync, writeFileSync } from "node:fs";
import { Workbook } from "exceljs";
import { parseLegacyWorkbook, validateXlsxZip } from "../../src/lib/domain/legacy-import";
async function main(){
  const path=process.argv[2];if(!path)throw new Error("Usage: tsx scripts/admin/legacy-preview.ts workbook.xlsx [output.json]");
  const bytes=readFileSync(path);validateXlsxZip(bytes);const b=new Workbook();await b.xlsx.load(bytes as unknown as Parameters<typeof b.xlsx.load>[0]);const p=parseLegacyWorkbook(b);
  if(process.argv[3])writeFileSync(process.argv[3],JSON.stringify(p,null,2),{mode:0o600});
  console.log(JSON.stringify({summary:p.summary,readyOrders:p.rows.filter(r=>r.kind==="order"&&!r.errors.length).length,readyExpenses:p.rows.filter(r=>r.kind==="expense"&&!r.errors.length).length,readyOrderRevenue:p.rows.filter(r=>r.kind==="order"&&!r.errors.length&&r.status==="COMPLETED").reduce((s,r)=>s+r.amount!,0),blocked:p.rows.filter(r=>r.errors.length).map(r=>({kind:r.kind,row:r.row,legacyId:r.legacyId,errors:r.errors})),warnings:p.rows.filter(r=>r.warnings.length).map(r=>({kind:r.kind,row:r.row,legacyId:r.legacyId,warnings:r.warnings})),dateFormattedHours:p.rows.filter(r=>r.kind==="order"&&r.warnings.some(w=>w.startsWith("Часы"))).map(r=>r.legacyId)},null,2));
}
main().catch(()=>{console.error("Legacy preview failed. Check workbook structure and input path.");process.exitCode=1;});
