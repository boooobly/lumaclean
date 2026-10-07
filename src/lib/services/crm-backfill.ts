import type {PrismaClient} from "@/generated/prisma/client";
import {normalizedPhone} from "@/lib/domain/crm";
import {writeAudit} from "./audit";
// Additive release step for legacy contacts: trustworthy E.164 only, no PII output.
export async function backfillPhones(db:PrismaClient) {
  let changed=0;
  for(const model of ["client","lead"] as const) {
    let cursor: string | undefined;
    while(true) {
      const args={where:{normalizedPhone:null},select:{id:true,phone:true},orderBy:{id:"asc" as const},take:100,...(cursor ? {cursor:{id:cursor},skip:1} : {})};
      const rows=model==="client" ? await db.client.findMany(args) : await db.lead.findMany(args);
      if(!rows.length)break;
      for(const row of rows) {
        if(!row.phone)continue; const normalized=normalizedPhone(row.phone);if(!normalized)continue;
        await db.$transaction(async tx=>{
          const data={normalizedPhone:normalized},where={id:row.id,phone:row.phone!,normalizedPhone:null};
          const result=model==="client" ? await tx.client.updateMany({where,data}) : await tx.lead.updateMany({where,data});
          if(result.count) {await writeAudit(tx,{type:"SYSTEM",key:"crm-phone-backfill"},{action:"PHONE_NORMALIZED",entityType:model==="client" ? "Client" : "Lead",entityId:row.id,changes:{changedFields:{before:null,after:["normalizedPhone"]}}});changed++;}
        });
      }
      cursor=rows.at(-1)!.id;
    }
  }
  return changed;
}
