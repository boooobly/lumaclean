import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getCurrentUser} from '@/lib/auth/session';
import {getDatabase} from '@/lib/database/client';
import {adminRateLimit,boundedBody} from '@/lib/services/admin-http';
import {conversationScenarios,conversationPreview} from '@/lib/agent/conversation-preview';
import {AgentError} from '@/lib/agent/contracts';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(request:Request){
 if(process.env.VERCEL_ENV!=='preview')return NextResponse.json({error:'PREVIEW_ONLY'},{status:403});
 if(![process.env.BETTER_AUTH_URL,process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:null].includes(request.headers.get('origin'))||!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'ORIGIN_REQUIRED'},{status:403});
 const user=await getCurrentUser();if(user?.role!=='ADMIN')return NextResponse.json({error:'ADMIN_REQUIRED'},{status:403});
 try{await adminRateLimit(user.id,'conversation-preview',20);const input=z.object({action:z.enum(['start','turn','cleanup']),scenario:z.enum(Object.keys(conversationScenarios) as [keyof typeof conversationScenarios,...Array<keyof typeof conversationScenarios>]),provider:z.enum(['primary','fallback']),conversationId:z.string().max(100).optional()}).strict().parse(JSON.parse((await boundedBody(request,1000)).toString()));return NextResponse.json(await conversationPreview(getDatabase(),user.id,input),{headers:{'Cache-Control':'no-store'}});}
 catch(e){return NextResponse.json({error:e instanceof AgentError?e.code:'PREVIEW_FAILED',status:'INCONCLUSIVE'},{status:400});}
}
