import type {PrismaClient} from '@/generated/prisma/client';
import {AgentError} from '../contracts';
import {previewTestAllowed} from '../live-proof';

/** Request-local test admission. No channel modes, connection diagnostics or
 * credentials are written. Only fixed, owned synthetic Preview conversations
 * can use this client, with a no-network outbound adapter in the harness.
 */
export function whatsappFixtureDatabase(db:PrismaClient){
 if(!previewTestAllowed()||!new URL(process.env.DATABASE_URL!).hostname.startsWith('ep-wispy-river-b8xwqy9q'))throw new AgentError('ISOLATED_PREVIEW_REQUIRED');
 const fixture=<T extends {aiChannelModes?:unknown}>(row:T|null)=>row?{...row,aiChannelModes:{...row.aiChannelModes as object,WHATSAPP:'AUTO'}}:row;
 return db.$extends({query:{businessSettings:{
  async findUnique({args,query}){return fixture(await query(args));},
  async findUniqueOrThrow({args,query}){return fixture(await query(args))!;},
 }}}) as unknown as PrismaClient;
}
