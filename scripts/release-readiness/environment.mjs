import {readdirSync, readFileSync} from 'node:fs';
import path from 'node:path';

export function localClusterDirectory() {
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.LUMACLEAN_LOCAL_PG18 === 'true') return '/lumaclean-test/pgdata18';
  return path.resolve(process.env.LUMACLEAN_LOCAL_PG18 === 'true' ? 'artifacts/release-readiness/pgdata18' : 'artifacts/release-readiness/pgdata');
}

// Blank every dotenv key so Next/Prisma cannot silently restore local live settings.
export function isolatedEnvironment(database = 'lumaclean_admin_test', port = 3100) {
  if (!['lumaclean_admin_test', 'lumaclean_admin_bootstrap_test', 'lumaclean_migration_test', 'lumaclean_reliability_test', 'lumaclean_ai_test', 'lumaclean_staging_test'].includes(database)) throw Error('Unknown disposable database');
  const env = {...process.env};
  for (const file of readdirSync('.').filter(name => /^\.env(?:\.|$)/.test(name))) {
    for (const match of readFileSync(file, 'utf8').matchAll(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/gm)) env[match[1]] = '';
  }
  for (const key of Object.keys(env)) if (/(?:DATABASE|DIRECT_URL|TEST_BASE_URL|TOKEN|SECRET|API_KEY|WEBHOOK|AI_|VERCEL|ROUTING_URL)/.test(key)) env[key] = '';
  Object.assign(env, {
    DATABASE_URL: `postgresql://postgres@127.0.0.1:55449/${database}`,
    DIRECT_URL: `postgresql://postgres@127.0.0.1:55449/${database}`,
    BETTER_AUTH_URL: `http://localhost:${port}`,
    BETTER_AUTH_SECRET: 'synthetic-release-readiness-secret-local-only-2026',
    NEXT_PUBLIC_SITE_URL: 'https://lumacleanrs.com',
    AI_AGENT_ENABLED: 'false', NEXT_TELEMETRY_DISABLED: '1',
    LUMACLEAN_ROUTING_PROVIDER: 'GOOGLE',
    LUMACLEAN_GOOGLE_ROUTING_ENABLED: 'false',
    CHAT_STORAGE_NAMESPACE: 'audit-20261101-local',
    CRON_SECRET: 'synthetic-loopback-recovery-key-only-20261101',
  });
  if (database === 'lumaclean_staging_test') {
    if(process.env.LUMACLEAN_LOCAL_PG18!=='true')throw Error('PostgreSQL 18 staging required');
    const credentials=JSON.parse(readFileSync('artifacts/audit-20261101/staging-credentials.json','utf8'));
    if(credentials.syntheticLocalOnly!==true)throw Error('Invalid local credentials fixture');
    const connection=(role,password)=>{const url=new URL(`postgresql://127.0.0.1:55449/${database}`);url.username=role;url.password=password;return url.toString();};
    env.DATABASE_URL=connection('lumaclean_staging_app',credentials.appPassword);
    env.DIRECT_URL=connection('lumaclean_staging_migrator',credentials.migrationPassword);
  }
  return env;
}
