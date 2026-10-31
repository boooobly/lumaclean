// Match the current production source layout; omit env, artifacts and auth files.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root='artifacts/production-release-2026-10-31/';
const prior=JSON.parse(readFileSync(root+'production-file-manifest.json','utf8'));
const files=[],uploads=[];
const paths=new Set(prior.map(p=>p.file.replace(/^src\//,'')));
for(const p of ['public/media/journey-v5/stills/000-portrait.webp','public/media/journey-v5/stills/000-before-portrait.webp','docs/pagespeed-audit-2026-10-31.md','docs/production-release-2026-10-31.md'])paths.add(p);
for(const file of paths){
 assert.ok(!/(^|\/)(\.env[^/]*|auth\.json|.*credentials.*)$/.test(file),'Sensitive file');
 assert.ok(!/^(artifacts|node_modules|\.git|\.vercel)\//.test(file),'Local-only file');
 assert.ok(existsSync(file),'Missing previous deployment source: '+file);
 const bytes=readFileSync(file),sha=createHash('sha1').update(bytes).digest('hex');
 files.push({file,sha,size:bytes.length});
 const old=prior.find(p=>p.file==='src/'+file);
 if(!old||old.sha!==sha)uploads.push({file,sha,size:bytes.length});
}
assert.ok(files.some(f=>f.file==='scripts/copy-maplibre-worker.mjs'));
assert.ok(files.some(f=>f.file==='release/ai-go-live.json'));
writeFileSync(root+'deployment-manifest.json',JSON.stringify({files,uploads},null,2));
console.log(JSON.stringify({files:files.length,uploads:uploads.map(f=>({file:f.file,size:f.size})),uploadBytes:uploads.reduce((n,f)=>n+f.size,0)},null,2));
