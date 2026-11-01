import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const rows=JSON.parse(readFileSync('docs/audit/evidence/deployed-migrations.json','utf8'));
const report=rows.map(r=>{const bytes=readFileSync(`prisma/migrations/${r.migration_name}/migration.sql`),text=bytes.toString('utf8').replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
 const variants={raw:bytes,LF:text,CRLF:text.replaceAll('\n','\r\n'),'BOM+LF':'\uFEFF'+text,'BOM+CRLF':'\uFEFF'+text.replaceAll('\n','\r\n')};
 const match=Object.entries(variants).find(([,v])=>createHash('sha256').update(v).digest('hex')===r.checksum);
 return{name:r.migration_name,match:!!match,normalization:match?.[0]??'MISMATCH'};});
writeFileSync('docs/audit/evidence/migration-parity.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({migrations:report.length,matches:report.filter(r=>r.match).length}));process.exitCode=report.every(r=>r.match)?0:1;
