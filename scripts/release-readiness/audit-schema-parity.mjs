import {readFileSync,writeFileSync} from 'node:fs';
import pg from 'pg';
const db=new pg.Client({connectionString:'postgresql://postgres@127.0.0.1:55449/lumaclean_admin_test'});await db.connect();
try {
 const expected=JSON.parse(readFileSync('docs/audit/evidence/production-schema-hashes.json','utf8'));
 const actual=(await db.query(readFileSync('docs/audit/evidence/schema-parity.sql','utf8'))).rows;
 const all=[...new Set([...expected,...actual].map(r=>r.table_name))];
 const differences=all.flatMap(name=>{const e=expected.find(r=>r.table_name===name),a=actual.find(r=>r.table_name===name);const fields=['columns_hash','indexes_hash','constraints_hash'].filter(k=>e?.[k]!==a?.[k]);return fields.length?[{table:name,fields}]:[];});
 const report={scope:'Column types/defaults/nullability/precision, index definitions and constraints only; excludes data, privileges, functions, triggers and enum labels',productionTables:expected.length,localTables:actual.length,differences};
 writeFileSync('docs/audit/evidence/schema-parity.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.end();}
