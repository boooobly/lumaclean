import { loadEnvConfig } from '@next/env';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '../../src/generated/prisma/client';
import { pgConnectionString } from '../../src/lib/database/connection';
import { priceMatrix, extrasPrices, serviceIds } from '../../src/lib/pricing';
import { upholsteryDefaults } from '../../src/lib/upholstery';

// Prospective catalogue only. Never seed, reprice orders or rewrite snapshots.
loadEnvConfig(process.cwd());
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL required');
const apply = process.argv.includes('--apply');
const directUrl = new URL(process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL);
if (directUrl.hostname.endsWith('.neon.tech')) directUrl.hostname = directUrl.hostname.replace('-pooler.', '.');
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConnectionString(directUrl.toString()), max: 1 }) });
const release = 'approved-pricing-20261017';
const units: Record<string, string> = { cabinets: 'section', ironing: '30min', linen: 'bed' };
const protectedTables = ['Order', 'OrderExtra', 'OrderCleaner', 'OrderUpholstery', 'OrderRepeatSeries', 'Client', 'Lead', 'LeadExtra', 'Expense', 'CleanerPayout', 'Investment', 'BusinessSettings', 'DurationRule'];
async function fingerprints(tx: Prisma.TransactionClient) {
  const result: Record<string, unknown> = {};
  for (const table of protectedTables) {
    // Names are a closed constant list, never user input. Only hashes leave DB.
    result[table] = await tx.$queryRawUnsafe(`SELECT count(*)::int AS count, md5(coalesce(string_agg(md5(t::text), '' ORDER BY t::text), '')) AS hash FROM "${table}" t`);
  }
  return result;
}
async function main() {
  const result = await db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET LOCAL lock_timeout = \'5s\'');
    if (apply) {
      await tx.$executeRawUnsafe(`LOCK TABLE ${protectedTables.map(t => `"${t}"`).join(', ')} IN SHARE MODE`);
      await tx.$executeRawUnsafe('LOCK TABLE "ServicePriceBand", "ServiceExtra", "UpholsterySettings" IN SHARE ROW EXCLUSIVE MODE');
    }
    const before = await fingerprints(tx), changes: unknown[] = [], effectiveAt = new Date();
    for (const code of serviceIds) {
      const service = await tx.service.findUniqueOrThrow({ where: { code } });
      if (!service.active) continue;
      const active = await tx.servicePriceBand.findMany({ where: { serviceId: service.id, validFrom: { lte: effectiveAt }, OR: [{ validUntil: null }, { validUntil: { gt: effectiveAt } }] }, orderBy: { minArea: 'asc' } });
      if (active.length !== 5 || active.some((b, i) => Number(b.minArea) !== [0,40,60,80,100][i] || (b.maxArea === null ? null : Number(b.maxArea)) !== [40,60,80,100,null][i])) throw new Error(`Unexpected active bands: ${code}`);
      if (active.every((b, i) => Number(i < 4 ? b.fixedPrice : b.pricePerSquare) === priceMatrix[code][i])) continue;
      changes.push({ service: code, old: active.map((b,i) => Number(i < 4 ? b.fixedPrice : b.pricePerSquare)), new: priceMatrix[code] });
      if (apply) {
        await tx.servicePriceBand.updateMany({ where: { id: { in: active.map(b => b.id) } }, data: { validUntil: effectiveAt } });
        for (let i = 0; i < 5; i++) await tx.servicePriceBand.create({ data: { id: `${release}-${code}-${i}`, serviceId: service.id, minArea: [0,40,60,80,100][i], maxArea: [40,60,80,100,null][i], fixedPrice: i < 4 ? priceMatrix[code][i] : null, pricePerSquare: i === 4 ? priceMatrix[code][i] : null, validFrom: effectiveAt } });
      }
    }
    for (const [code, unitPrice] of Object.entries(extrasPrices)) {
      const row = await tx.serviceExtra.findUniqueOrThrow({ where: { code } });
      if (!row.active) continue;
      const unit = units[code] ?? row.unit;
      if (Number(row.unitPrice) === unitPrice && row.unit === unit) continue;
      changes.push({ extra: code, old: Number(row.unitPrice), new: unitPrice, oldUnit: row.unit, unit });
      if (apply) await tx.serviceExtra.update({ where: { id: row.id }, data: { unitPrice, unit } });
    }
    const settings = await tx.upholsterySettings.findUniqueOrThrow({ where: { id: 'default' } });
    const catalog = settings.catalog as Record<string, number>;
    if (Object.entries(upholsteryDefaults).some(([key, value]) => catalog[key] !== value)) {
      changes.push({ upholstery: 'default', old: catalog, new: upholsteryDefaults });
      if (apply) await tx.upholsterySettings.update({ where: { id: settings.id }, data: { catalog: { ...catalog, ...upholsteryDefaults }, version: { increment: 1 } } });
    }
    const after = await fingerprints(tx);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('Protected history changed; rolling back');
    return { release, apply, effectiveAt, changes, historicalFinanceUnchanged: true, fingerprints: after };
  }, { maxWait: 10000, timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Catalogue update failed'); process.exitCode = 1; }).finally(() => db.$disconnect());
