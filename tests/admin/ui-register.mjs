import { createRequire } from 'node:module';
// tsx compiles this CommonJS project for Node; only test-process imports are stubbed.
const require = createRequire(import.meta.url), Module = require('node:module');
require.extensions['.css'] = module => module._compile('module.exports={}', module.filename);
const load = Module._load;
Module._load = function(specifier, ...args) {
  if (specifier === 'server-only') return {};
  if (specifier === 'next/navigation') return {usePathname:()=>'/admin/messages/test',useRouter:()=>({refresh(){},push(){}})};
  return load.call(this, specifier, ...args);
};
