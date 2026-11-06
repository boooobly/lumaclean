import {readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const rows=JSON.parse(readFileSync('docs/audit/evidence/deployed-migrations.json','utf8')),parity=JSON.parse(readFileSync('docs/audit/evidence/migration-parity.json','utf8'));
const results=[];
for(const {name} of parity.filter(r=>!r.match)){
 const file=`prisma/migrations/${name}/migration.sql`,expected=rows.find(r=>r.migration_name===name).checksum;
 const commits=spawnSync('git',['log','--all','--format=%H','--',file],{encoding:'utf8'}).stdout.trim().split(/\s+/);
 let match=null,cosmeticMatch=null;
 const current=readFileSync(file,'utf8').replace(/^\uFEFF/,'').replaceAll('\r\n','\n');
 for(const eol of ['\n','\r\n'])for(const bom of ['', '\uFEFF'])for(let trailing=0;trailing<6;trailing++)for(const trimSpaces of [false,true]){
  const body=(trimSpaces?current.replace(/[ \t]+$/gm,''):current).trimEnd().replaceAll('\n',eol);
  const variant=bom+body+eol.repeat(trailing);
  if(createHash('sha256').update(variant).digest('hex')===expected)cosmeticMatch={eol:eol==='\n'?'LF':'CRLF',bom:!!bom,trailingNewlines:trailing,trimSpaces};
 }
 for(const sha of commits){const r=spawnSync('git',['show',`${sha}:${file}`],{encoding:'utf8',maxBuffer:4*1024*1024});if(r.status!==0)continue;const text=r.stdout;
  if([text,text.replaceAll('\r\n','\n'),text.replace(/(?<!\r)\n/g,'\r\n')].some(s=>createHash('sha256').update(s).digest('hex')===expected)){match=sha;break;}}
 const diff=match?spawnSync('git',['diff',match,'HEAD','--',file],{encoding:'utf8'}).stdout:null;
 results.push({name,matchingHistoricalCommit:match,cosmeticMatch,diff});
}
writeFileSync('docs/audit/evidence/migration-history.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results));
