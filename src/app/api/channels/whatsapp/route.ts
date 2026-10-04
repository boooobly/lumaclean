import {customerWebhook} from '@/lib/agent/channel-webhook';
import {verifyWhatsAppChallenge} from '@/lib/agent/channels';
export const runtime='nodejs';
export const maxDuration=180;
export async function GET(request:Request){const challenge=verifyWhatsAppChallenge(new URL(request.url));return new Response(challenge,{status:challenge?200:403,headers:{'Cache-Control':'no-store','Content-Type':'text/plain'}});}
export async function POST(request:Request){return customerWebhook(request,'WHATSAPP');}
