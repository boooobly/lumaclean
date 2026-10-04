import {customerWebhook} from '@/lib/agent/channel-webhook';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(request:Request){return customerWebhook(request,'VIBER');}
