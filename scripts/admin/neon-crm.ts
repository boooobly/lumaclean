// Release utility. Environment values stay in private files and never enter CLI arguments/logs.
import {readFileSync,writeFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
import {randomBytes,randomUUID} from "node:crypto";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../../src/generated/prisma/client";
import {pgConnectionString} from "../../src/lib/database/connection";
import {backfillPhones} from "../../src/lib/services/crm-backfill";
import {provisionFirstAdmin} from "./provision";
const [stage,mode]=process.argv.slice(2);
if(!["preview","production"].includes(stage) || !["inspect","migrate","preview-admin","remove-preview-admin"].includes(mode))throw Error("Use explicit preview/production and supported mode");
if(mode.includes("admin") && stage!=="preview")throw Error("Preview users are never provisioned on production");
const env={...process.env};
for(const line of readFileSync(`C:/Users/vleko/.codex/private/lumaclean-neon-${stage}.env`,"utf8").split(/\r?\n/)){
 const match=line.match(/^([A-Z_]+)=(.*)$/);if(match){let v=match[2].trim();if(v.startsWith('"') && v.endsWith('"'))v=JSON.parse(v);env[match[1]]=v;}
}
if(!env.DATABASE_URL || !env.DIRECT_URL)throw Error("Private environment not found");
const expected=stage==="production" ? "ep-bitter-mode-b8r8ruag" : "ep-patient-field-b8mccfvd";
if(!new URL(env.DATABASE_URL).hostname.startsWith(expected) || !new URL(env.DIRECT_URL).hostname.startsWith(expected) || new URL(env.DIRECT_URL).hostname.includes("-pooler"))throw Error("Unexpected Neon target");
const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(env.DATABASE_URL),max:1})});
async function main(){
 const counts=await Promise.all([db.client.count(),db.lead.count(),db.order.count(),db.user.count({where:{role:"ADMIN"}})]);
 console.log(JSON.stringify({stage,clients:counts[0],leads:counts[1],orders:counts[2],admins:counts[3]}));
 if(mode==="inspect")return;
 if(mode==="migrate"){
   const legacy=await db.$queryRaw<{soilLevel:string | null}[]>`SELECT DISTINCT "soilLevel"::text AS "soilLevel" FROM "Order"`;
   if(legacy.some(r=>r.soilLevel && !["LIGHT","NORMAL","HEAVY","EXTREME"].includes(r.soilLevel)))throw Error("Unsupported legacy soil value. Review before migration.");
   const prisma=require.resolve("prisma/build/index.js");
   const migration=spawnSync(process.execPath,[prisma,"migrate","deploy"],{env,encoding:"utf8",windowsHide:true});
   if(migration.status!==0)throw Error("Neon migration failed; inspect Prisma migration status locally");
   console.log("Migrations deployed");
   const updated=await backfillPhones(db);console.log(`Legacy normalized contacts: ${updated}`);
   const diff=spawnSync(process.execPath,[prisma,"migrate","diff","--from-config-datasource","--to-schema","prisma/schema.prisma","--exit-code"],{env,encoding:"utf8",windowsHide:true});
   if(diff.status!==0)throw Error("Schema drift detected");console.log("Schema diff empty");
   const after=await Promise.all([db.client.count(),db.lead.count(),db.order.count(),db.user.count({where:{role:"ADMIN"}})]);
   if(JSON.stringify(after)!==JSON.stringify(counts))throw Error("Unexpected operational record count change");console.log("Operational record counts preserved");
 }
 if(mode==="preview-admin"){
   const password=randomBytes(24).toString("base64url"),email=`crm-preview-${randomUUID()}@example.invalid`;
   await provisionFirstAdmin(db,{name:"CRM Preview",email,password});
   writeFileSync("artifacts/admin/crm-preview-owner.json",JSON.stringify({name:"CRM Preview",email,password}));
   console.log("Temporary preview administrator prepared");
 }
 if(mode==="remove-preview-admin"){
   const {email}=JSON.parse(readFileSync("artifacts/admin/crm-preview-owner.json","utf8"));
   if(!/^crm-preview-[a-f0-9-]+@example\.invalid$/.test(email))throw Error("Unexpected preview verifier");
   await db.$transaction(async tx=>{
     const verifier=await tx.user.findFirst({where:{email,role:"ADMIN"}});
     if(!verifier)return;
     await tx.session.deleteMany({where:{userId:verifier.id}});
     if(await tx.auditLog.count({where:{userId:verifier.id}})){
       // Historical USER audit is immutable; retain its actor and revoke access.
       await tx.user.update({where:{id:verifier.id},data:{active:false}});
     }else{
       await tx.account.deleteMany({where:{userId:verifier.id}});
       await tx.user.delete({where:{id:verifier.id}});
     }
   });console.log("Temporary preview access removed; audit retained");
 }
}
main().catch(()=>{console.error("Release operation failed safely. No credentials or contacts logged.");process.exitCode=1;}).finally(()=>db.$disconnect());
