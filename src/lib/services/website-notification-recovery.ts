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
  const rows = await db.notification.findMany({
    where: {
      kind: 'WEBSITE_LEAD', audience: 'ADMIN', channel: 'TELEGRAM',
      OR: [
        {deliveryState: 'PENDING', scheduledAt: {lte: now}, OR: [{nextAttemptAt: null}, {nextAttemptAt: {lte: now}}]},
        {deliveryState: 'SENDING', leaseUntil: {lt: now}},
      ],
    },
    orderBy: [{scheduledAt: 'asc'}, {id: 'asc'}], take: 10, select: {id: true},
  });
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
