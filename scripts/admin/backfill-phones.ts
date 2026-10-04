import {loadEnvConfig} from "@next/env";
import {PrismaPg} from "@prisma/adapter-pg";
import {PrismaClient} from "../../src/generated/prisma/client";
import {pgConnectionString} from "../../src/lib/database/connection";
import {backfillPhones} from "../../src/lib/services/crm-backfill";
loadEnvConfig(process.cwd());
if(!process.env.DATABASE_URL)throw new Error("DATABASE_URL is required");
const db=new PrismaClient({adapter:new PrismaPg({connectionString:pgConnectionString(process.env.DATABASE_URL),max:1})});
backfillPhones(db).then(count=>console.log(`Normalized legacy contact records: ${count}`)).catch(()=>{console.error("Contact normalization failed. Check database migrations.");process.exitCode=1;}).finally(()=>db.$disconnect());
