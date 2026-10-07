import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizedSource} from '../../src/lib/agent/release-verification.mjs';
import {sourceFingerprint} from '../../src/lib/agent/release-verification.mjs';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,relative,isAbsolute} from 'node:path';
test('release verification tolerates Vercel config serialization only',()=>{
  assert.equal(normalizedSource('vercel.json','{ "installCommand": "npm ci", "functions": {} }'),normalizedSource('vercel.json','{"functions":{},"installCommand":"npm ci"}\n'));
});
test('release verification still detects deployment changes and source whitespace changes',()=>{
  assert.notEqual(normalizedSource('vercel.json','{"installCommand":"npm ci"}'),normalizedSource('vercel.json','{"installCommand":"npm install"}'));
  assert.notEqual(normalizedSource('src/a.ts','const a=1;'),normalizedSource('src/a.ts','const a=2;'));
});
test('source proof ignores platform-owned config but rejects changed application code',()=>{
  const base=resolve(tmpdir()),root=mkdtempSync(join(base,'lumaclean-release-'));
  try{
    mkdirSync(join(root,'src'));mkdirSync(join(root,'prisma/migrations'),{recursive:true});
    mkdirSync(join(root,'scripts'));mkdirSync(join(root,'infrastructure/routing-gateway'),{recursive:true});
    for(const path of ['prisma/schema.prisma','next.config.ts','package.json','package-lock.json','.vercelignore','scripts/copy-maplibre-worker.mjs','infrastructure/routing-gateway/routing-policy.json'])writeFileSync(join(root,path),'{}');
    writeFileSync(join(root,'src/a.ts'),'const a=1;');
    const before=sourceFingerprint(root);
    writeFileSync(join(root,'vercel.json'),'platform builder rewrites this');
    assert.equal(sourceFingerprint(root),before);
    writeFileSync(join(root,'src/a.ts'),'const a=2;');
    assert.notEqual(sourceFingerprint(root),before);
  }finally{
    const path=relative(base,resolve(root));
    if(!path.startsWith('lumaclean-release-')||path.includes('..')||isAbsolute(path))throw Error('Unexpected fixture root');
    rmSync(root,{recursive:true});
  }
});
