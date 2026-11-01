import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(f=>f.isDirectory()?walk(`${dir}/${f.name}`):[`${dir}/${f.name}`]);}
const paths=walk('src').filter(p=>!p.startsWith('src/generated/'));
const api=paths.filter(p=>p.endsWith('/route.ts')&&p.startsWith('src/app/api/')).map(file=>{
 const code=readFileSync(file,'utf8');
 return{file,methods:[...code.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE)/g)].map(m=>m[1]),guards:['getCurrentUser','requireAdmin','requireUser','trustedOrigin','timingSafeEqual','handleCallback','customerWebhook','scopedConversation','boundedBody','adminRateLimit'].filter(term=>code.includes(term))};
});
const schema=readFileSync('prisma/schema.prisma','utf8');
const inventory={sourceFiles:paths.length,apiRoutes:api.length,api,models:[...schema.matchAll(/^model\s+(\w+)/gm)].map(m=>m[1]),migrations:readdirSync('prisma/migrations').filter(n=>/^\d/.test(n)),services:walk('src/lib/services').filter(p=>p.endsWith('.ts')),documents:walk('docs').filter(p=>p.endsWith('.md')).length,gitHead:spawnSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim()};
writeFileSync('docs/audit/evidence/inventory.json',JSON.stringify(inventory,null,2));
const raw=readFileSync('artifacts/audit-20261101/dependency-audit.json','utf8');
const audit=JSON.parse(raw.slice(raw.indexOf('{'),raw.lastIndexOf('}')+1));
const security={dependencyCounts:audit.metadata.vulnerabilities,dependencies:Object.values(audit.vulnerabilities).map(v=>({name:v.name,severity:v.severity,isDirect:v.isDirect,fixAvailable:v.fixAvailable})),sensitiveFileHistoryMatches:readFileSync('artifacts/audit-20261101/sensitive-file-history.txt','utf8').trim()?true:false,highConfidenceHistoryPatternMatches:readFileSync('artifacts/audit-20261101/secret-pattern-history.txt','utf8').trim()?true:false,historyScope:'All fetched refs; selected high-confidence regexes, not an exhaustive forensic secret audit'};
writeFileSync('docs/audit/evidence/security-summary.json',JSON.stringify(security,null,2));
console.log(JSON.stringify({sourceFiles:paths.length,apiRoutes:api.length,models:inventory.models.length,migrations:inventory.migrations.length,dependencyCounts:security.dependencyCounts,secretPatternMatches:security.highConfidenceHistoryPatternMatches}));
