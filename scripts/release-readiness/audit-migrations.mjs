import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const rows=JSON.parse(readFileSync('docs/audit/evidence/deployed-migrations.json','utf8'));
const report=rows.map(r=>{const bytes=readFileSync(`prisma/migrations/${r.migration_name}/migration.sql`);
 const match=createHash('sha256').update(bytes).digest('hex')===r.checksum;
 return{name:r.migration_name,match,normalization:match?'raw':'MISMATCH'};});
writeFileSync('docs/audit/evidence/migration-parity.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({migrations:report.length,matches:report.filter(r=>r.match).length}));process.exitCode=report.every(r=>r.match)?0:1;
