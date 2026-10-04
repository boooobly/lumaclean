import {getDatabase} from '@/lib/database/client';
import {buildAgentTemporalContext} from '@/lib/agent/temporal';
export const runtime='nodejs';
export async function GET() {
  const headers={'Cache-Control':'no-store','X-Robots-Tag':'noindex'};
  try {
    const settings=await getDatabase().businessSettings.findUniqueOrThrow({where:{id:'default'}});
    const now=new Date(),context=buildAgentTemporalContext(now,settings,now);
    return Response.json({allowed:context.sameDayBookingAllowedNow,cutoff:context.sameDayBookingCutoff,earliestDate:context.earliestPotentialServiceDate,timezone:context.timezone,checkedAt:now.toISOString()},{headers});
  } catch { return Response.json({allowed:false},{status:503,headers}); }
}
