import {NextResponse} from 'next/server';
import {authorizedCron} from '@/lib/services/cron-auth';
import {getDatabase} from '@/lib/database/client';
import {maintainAiHealth} from '@/lib/agent/health-maintenance';
export const runtime='nodejs';
export const maxDuration=180;
const headers={'Cache-Control':'private, no-store'};
export async function GET(request:Request){
  if(!authorizedCron(request))return NextResponse.json({ok:false},{status:401,headers});
  try{
    const result=await maintainAiHealth(getDatabase());
    console.info(JSON.stringify({event:'ai_health_cron',...result}));
    return NextResponse.json(result,{status:result.status==='FAIL'?503:200,headers});
  }catch{
    console.error(JSON.stringify({event:'ai_health_cron',status:'FAIL',reason:'CHECK_UNAVAILABLE'}));
    return NextResponse.json({status:'FAIL',reason:'CHECK_UNAVAILABLE'},{status:503,headers});
  }
}
