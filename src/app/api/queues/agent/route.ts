import {handleCallback} from '@vercel/queue';
import {getDatabase} from '@/lib/database/client';
import {consumeAgentWake} from '@/lib/agent/queue';
export const runtime='nodejs';
export const maxDuration=180;
// Private queue trigger. Vercel verifies delivery and the SDK renews visibility.
export const POST=handleCallback(async payload=>consumeAgentWake(getDatabase(),payload),{
  visibilityTimeoutSeconds:240,
  retry:(_error,metadata)=>({afterSeconds:Math.min(300,30*metadata.deliveryCount)}),
});
