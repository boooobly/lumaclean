import { loadEnvConfig } from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../src/generated/prisma/client';
import { pgConnectionString } from '../../src/lib/database/connection';
import { extrasPrices } from '../../src/lib/pricing';

// Prospective, existing catalogue rows only. Dry run unless --apply is explicit.
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const apply = process.argv.includes('--apply');
const codes = ['standardWindow', 'largeWindow'] as const;
const url = new URL(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
if (url.hostname.endsWith('.neon.tech')) url.hostname = url.hostname.replace('-pooler.', '.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConnectionString(url.toString()), max: 1 }) });
const protectedTables = ['Order', 'OrderExtra', 'OrderCleaner', 'OrderUpholstery', 'OrderRepeatSeries', 'Client', 'Lead', 'LeadExtra', 'Expense', 'CleanerPayout', 'Investment', 'BusinessSettings', 'DurationRule', 'Service', 'ServicePriceBand', 'UpholsterySettings'];
async function fingerprints(tx: Prisma.TransactionClient) {
  const hashes: Record<string, unknown> = {};
  for (const table of protectedTables) {
    // Table names are a closed list; no customer data leaves the database.
    hashes[table] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(t::text), '' ORDER BY t::text), '')) AS hash FROM "${table}" t`);
  }
  hashes.otherExtras = await tx.$queryRaw`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(t::text), '' ORDER BY t::text), '')) AS hash FROM "ServiceExtra" t WHERE code NOT IN ('standardWindow', 'largeWindow')`;
  return hashes;
}
async function main() {
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
    if (apply) {
      await tx.$executeRawUnsafe(`LOCK TABLE ${protectedTables.map(t => `"${t}"`).join(', ')} IN SHARE MODE`);
      await tx.$executeRawUnsafe('LOCK TABLE "ServiceExtra" IN SHARE ROW EXCLUSIVE MODE');
    }
    const before = await fingerprints(tx), changes = [];
    for (const code of codes) {
      const row = await tx.serviceExtra.findUniqueOrThrow({ where: { code } });
      if (!row.active || row.unit !== 'item') throw new Error(`Unexpected catalogue row: ${code}`);
      const unitPrice = extrasPrices[code];
      if (Number(row.unitPrice) === unitPrice) continue;
      changes.push({ id: row.id, code, old: Number(row.unitPrice), new: unitPrice, unit: row.unit });
      if (apply) await tx.serviceExtra.update({ where: { id: row.id }, data: { unitPrice } });
    }
    const after = await fingerprints(tx);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Protected data changed; rolling back');
    return { apply, changes, historicalSnapshotsUnchanged: true, otherCatalogueUnchanged: true, fingerprints: after };
  }, { maxWait: 10000, timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Window catalogue update failed'); process.exitCode = 1; }).finally(() => db.$disconnect());
