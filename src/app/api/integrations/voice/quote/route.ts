import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { calculatePrice, extrasPrices, serviceIds } from "@/lib/pricing";

export const runtime = "nodejs";
const inputSchema = z.object({
  service: z.enum(serviceIds),
  area: z.number().finite().min(25).max(180),
  extras: z.array(z.object({
    code: z.enum(Object.keys(extrasPrices) as [keyof typeof extrasPrices, ...(keyof typeof extrasPrices)[]]),
    quantity: z.number().int().min(1).max(20),
  }).strict()).max(14).default([]),
  urgent: z.boolean().default(false),
}).strict().refine(v => new Set(v.extras.map(x=>x.code)).size===v.extras.length);

function authorized(request: Request) {
  const expected = process.env.LUMACLEAN_VOICE_API_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || expected.length < 32 || !supplied) return false;
  const a=createHash("sha256").update(supplied).digest(),b=createHash("sha256").update(expected).digest();
  return timingSafeEqual(a,b);
}
export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ok:false},{status:401});
  const raw=await request.text();
  if(raw.length>8000)return NextResponse.json({ok:false},{status:413});
  let data: unknown; try{data=JSON.parse(raw);}catch{return NextResponse.json({ok:false},{status:400});}
  const parsed=inputSchema.safeParse(data);
  if(!parsed.success)return NextResponse.json({ok:false,error:"INVALID_QUOTE_INPUT"},{status:400});
  const v=parsed.data;
  const quote=calculatePrice(v.service,v.area,v.extras,v.urgent);
  return NextResponse.json({ok:true,currency:"RSD",service:v.service,area:v.area,base:quote.base,extras:quote.extras,total:quote.total,preliminary:true,bookingConfirmed:false,requiresHumanConfirmation:true,source:"LUMACLEAN_SITE_PRICING"},{headers:{"Cache-Control":"no-store"}});
}
