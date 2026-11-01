import type {PrismaClient} from '@/generated/prisma/client';
import {deliverNotification} from '@/lib/agent/notifications';

/** A small safety net for committed website leads, independent of Queue and AI jobs. */
export async function recoverWebsiteLeadNotifications(
  db: PrismaClient,
  deliver = deliverNotification,
  clock = Date.now,
) {
  const started = clock();
  const now = new Date(started);
  // Voice staging shares the WEBSITE_LEAD notification kind. Bind selection to
  // the persisted Lead channel as well, before LIMIT, so foreign work cannot
  // consume the batch or be delivered by this Website-only safety net.
  const rows = await db.$queryRaw<{id:string}[]>`
    SELECT n.id FROM "Notification" n
    JOIN "Lead" l ON l.id = n.payload->>'leadId'
    WHERE n.kind = 'WEBSITE_LEAD' AND n.audience = 'ADMIN' AND n.channel = 'TELEGRAM'
      AND l.channel = 'WEBSITE'
      AND ((n."deliveryState" = 'PENDING' AND n."scheduledAt" <= ${now}
            AND (n."nextAttemptAt" IS NULL OR n."nextAttemptAt" <= ${now}))
        OR (n."deliveryState" = 'SENDING' AND n."leaseUntil" < ${now}))
    ORDER BY n."scheduledAt" ASC, n.id ASC LIMIT 10
  `;
  let processed = 0, errors = 0;
  for (const row of rows) {
    // Leave time for a single bounded Telegram request and final DB writes.
    if (clock() - started >= 30_000) break;
    try { await deliver(db, row.id); }
    catch { errors++; /* The existing worker retains durable retries/leases. */ }
    processed++;
  }
  const states = processed ? await db.notification.findMany({
    where: {id: {in: rows.slice(0, processed).map(row => row.id)}},
    select: {deliveryState: true},
  }) : [];
  return {
    selected: rows.length, processed, deferred: rows.length - processed, errors,
    sent: states.filter(row => ['SENT', 'DELIVERED', 'READ'].includes(row.deliveryState)).length,
    pending: states.filter(row => ['PENDING', 'SENDING'].includes(row.deliveryState)).length,
    failed: states.filter(row => row.deliveryState === 'FAILED').length,
    unknown: states.filter(row => row.deliveryState === 'UNKNOWN').length,
    durationMs: Math.max(0, clock() - started),
  };
}
