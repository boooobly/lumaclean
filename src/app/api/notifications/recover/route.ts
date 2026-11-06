import {getDatabase} from '@/lib/database/client';
import {authorizedCron} from '@/lib/services/cron-auth';
import {recoverWebsiteLeadNotifications} from '@/lib/services/website-notification-recovery';

export const runtime = 'nodejs';
export const maxDuration = 60;
const headers = {'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow'};

export async function GET(request: Request) {
  if (!authorizedCron(request)) return Response.json({ok: false}, {status: 401, headers});
  try {
    const summary = await recoverWebsiteLeadNotifications(getDatabase());
    // Counters only: no lead IDs, text, contacts, tokens or upstream error messages.
    const log = JSON.stringify({msg: 'website_notification_recovery', ...summary});
    if (summary.failed || summary.unknown || summary.errors) console.warn(log);
    else if (summary.selected) console.info(log);
    return Response.json({ok: true, ...summary}, {headers});
  } catch {
    console.error(JSON.stringify({msg: 'website_notification_recovery_failed'}));
    return Response.json({ok: false}, {status: 503, headers});
  }
}
