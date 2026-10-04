import {handleCallback} from '@vercel/queue';
import {getDatabase} from '@/lib/database/client';
import {notificationWake,deliverNotification,publishNotifications} from '@/lib/agent/notifications';
export const runtime='nodejs';
export const maxDuration=180;
export const POST=handleCallback(async payload=>{const db=getDatabase();await deliverNotification(db,notificationWake.parse(payload).notificationId);await publishNotifications(db);},{visibilityTimeoutSeconds:240,retry:(_e,m)=>({afterSeconds:Math.min(300,30*m.deliveryCount)})});
