import {handleCallback} from '@vercel/queue';
import {getDatabase} from '@/lib/database/client';
import {notificationWake,deliverNotification} from '@/lib/agent/notifications';
export const runtime='nodejs';
export const maxDuration=180;
export const POST=handleCallback(async payload=>deliverNotification(getDatabase(),notificationWake.parse(payload).notificationId),{visibilityTimeoutSeconds:240,retry:(_e,m)=>({afterSeconds:Math.min(300,30*m.deliveryCount)})});
