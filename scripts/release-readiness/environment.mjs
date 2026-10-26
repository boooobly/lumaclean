import {readdirSync, readFileSync} from 'node:fs';

// Blank every dotenv key so Next/Prisma cannot silently restore local live settings.
export function isolatedEnvironment(database = 'lumaclean_admin_test', port = 3100) {
  if (!['lumaclean_admin_test', 'lumaclean_admin_bootstrap_test', 'lumaclean_migration_test', 'lumaclean_reliability_test', 'lumaclean_ai_test'].includes(database)) throw Error('Unknown disposable database');
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
  });
  return env;
}
