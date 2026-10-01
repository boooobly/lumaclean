import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {getCurrentUser} from '@/lib/auth/session';
import {getDatabase} from '@/lib/database/client';
import {boundedBody,adminRateLimit} from '@/lib/services/admin-http';
import {aiSettingsSchema,runAiSettings} from '@/lib/agent/settings';
import {AgentError} from '@/lib/agent/contracts';
export const runtime='nodejs';
export const maxDuration=180;
export async function POST(request:Request){
  if(!request.headers.get('origin')||![process.env.BETTER_AUTH_URL,process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:null].includes(request.headers.get('origin'))||!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({ok:false},{status:403});
  try{const user=await getCurrentUser();if(!user)return NextResponse.json({ok:false},{status:401});if(user.role!=='ADMIN')return NextResponse.json({ok:false},{status:403});
    const input=aiSettingsSchema.parse(JSON.parse((await boundedBody(request,12000)).toString()));
    await adminRateLimit(user.id,input.action==='diagnostics'?'ai-diagnostics':'ai-settings',input.action==='diagnostics'?2:15);
    const result=await runAiSettings(getDatabase(),user.id,input);revalidatePath('/admin','layout');
    return NextResponse.json({ok:true,result},{headers:{'Cache-Control':'private, no-store'}});
  }catch(e){return NextResponse.json({ok:false,error:e instanceof AgentError?e.code:'Проверьте настройки или повторите позже.'},{status:400});}
}
