import {createHmac, randomUUID} from 'node:crypto';
import {isIP} from 'node:net';
import type {Prisma} from '@/generated/prisma/client';
import {CrmError} from '@/lib/domain/crm';

export class LeadRateLimitError extends CrmError {
  constructor(public retryAfter:number){super('RATE_LIMIT','Too many new enquiries');}
}
/** Only Vercel's ingress is trusted to overwrite this header. Other hosts share a fallback bucket. */
export function leadRequestSource(request:Request){
  const forwarded=process.env.VERCEL==='1'?request.headers.get('x-forwarded-for')?.trim():undefined;
  let source=forwarded&&isIP(forwarded)?forwarded:'untrusted-source';
  if(isIP(source)===6){
    // Canonicalize IPv6 and group privacy addresses from the same /64.
    const canonical=new URL(`http://[${source}]/`).hostname.slice(1,-1);
    const [left,right='']=canonical.split('::');
    const prefix=left?left.split(':'):[],suffix=right?right.split(':'):[];
    source=[...prefix,...Array(8-prefix.length-suffix.length).fill('0'),...suffix].slice(0,4).join(':');
  }
  const secret=process.env.BETTER_AUTH_SECRET;
  if(process.env.VERCEL==='1'&&!secret)throw new Error('Lead rate limit secret is not configured');
  return createHmac('sha256',secret??'local-lead-limiter').update(source).digest('hex');
}
/** Called AFTER the idempotency check, in the same transaction as Lead and Notification. */
export async function limitNewWebsiteLead(tx:Prisma.TransactionClient,source:string){
  const now=Date.now();
  for(const {period,max} of [{period:600000,max:20},{period:86400000,max:100}]){
    const key=`website-lead:${source}:${period}`;
    const rows=await tx.$queryRaw<{count:number;lastRequest:bigint}[]>`
      INSERT INTO "RateLimit" (id,key,count,"lastRequest") VALUES (${randomUUID()},${key},1,${BigInt(now)})
      ON CONFLICT (key) DO UPDATE SET
        count=CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now-period)} THEN 1 ELSE "RateLimit".count+1 END,
        "lastRequest"=CASE WHEN "RateLimit"."lastRequest" <= ${BigInt(now-period)} THEN ${BigInt(now)} ELSE "RateLimit"."lastRequest" END
      RETURNING count,"lastRequest"`;
    if(rows[0].count>max)throw new LeadRateLimitError(Math.max(1,Math.ceil((Number(rows[0].lastRequest)+period-now)/1000)));
  }
}
