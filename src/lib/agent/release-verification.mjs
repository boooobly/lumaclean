import {createHash} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {join} from 'node:path';
export function normalizedSource(path,text){
  if(path==='vercel.json'){
    const sort=value=>Array.isArray(value)?value.map(sort):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(key=>[key,sort(value[key])])):value;
    return JSON.stringify(sort(JSON.parse(text)));
  }
  return text.replace(/\r\n/g,'\n');
}
export function sourceFingerprint(root=process.cwd()){
  const hash=createHash('sha256'),paths=[];
  function walk(dir){for(const item of readdirSync(join(root,dir),{withFileTypes:true})){const path=`${dir}/${item.name}`;if(path.startsWith('src/generated'))continue;if(item.isDirectory())walk(path);else paths.push(path);}}
  // Vercel rewrites vercel.json during build; only immutable application inputs certify tested code.
  walk('src');walk('prisma/migrations');paths.push('prisma/schema.prisma','next.config.ts','package.json','package-lock.json','scripts/copy-maplibre-worker.mjs','.vercelignore');
  for(const path of paths.sort())hash.update(path).update('\0').update(normalizedSource(path,readFileSync(join(root,path),'utf8'))).update('\0');
  return hash.digest('hex');
}
export function sourceInventory(root=process.cwd()){
  const files={};
  function walk(dir){for(const item of readdirSync(join(root,dir),{withFileTypes:true})){const path=`${dir}/${item.name}`;if(path.startsWith('src/generated'))continue;if(item.isDirectory())walk(path);else files[path]=createHash('sha256').update(readFileSync(join(root,path),'utf8').replace(/\r\n/g,'\n')).digest('hex');}}
  walk('src');walk('prisma/migrations');
  for(const path of ['prisma/schema.prisma','next.config.ts','package.json','package-lock.json','scripts/copy-maplibre-worker.mjs','.vercelignore'])files[path]=createHash('sha256').update(normalizedSource(path,readFileSync(join(root,path),'utf8'))).digest('hex');
  return files;
}
export function verifiedRelease(root=process.cwd()){
  try{const evidence=JSON.parse(readFileSync(join(root,'release/ai-go-live.json'),'utf8')),actual=sourceFingerprint(root),matches=evidence.fingerprint===actual;
    if(!matches&&evidence.files){const files=sourceInventory(root);console.info(JSON.stringify({msg:'ai_release_source_mismatch',changed:[...new Set([...Object.keys(files),...Object.keys(evidence.files)])].filter(path=>files[path]!==evidence.files[path])}));}
    return {verified:matches&&evidence.tests>0&&evidence.lint===true&&evidence.typecheck===true&&evidence.migration===true,count:evidence.tests};
  }catch{return{verified:false,count:0};}
}
