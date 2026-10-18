import {z} from 'zod';

const text=z.string().max(700);
export const knowledgeEntrySchema=z.object({
 code:z.string().regex(/^[A-Z0-9-]+$/),name:text,aliases:z.array(z.string().max(100)).max(35),
 category:z.enum(['cleaning','extra','upholstery','scope','rule']),
 status:z.enum(['OFFERED','BY_AGREEMENT','UNAVAILABLE']),description:text,unit:z.string().max(80),
 price:z.object({amount:z.number().finite().nonnegative(),currency:z.literal('RSD'),kind:z.enum(['fixed','from','included','percent']),unit:z.string().max(80)}).strict().nullable(),
 tariffs:z.array(z.object({min:z.number().nonnegative(),max:z.number().positive().nullable(),amount:z.number().nonnegative(),unit:z.enum(['object','m²'])}).strict()).max(5),
 appliesTo:z.array(z.string().max(80)).max(6),includes:text,excludes:text,restrictions:text,
 standalone:z.enum(['YES','NO','BY_AGREEMENT']),managerReview:z.boolean(),autoCalculate:z.boolean(),autoBook:z.boolean(),
 runtimeCode:z.string().max(40).nullable(),source:z.object({tab:z.number().int().min(1).max(6),row:z.number().int().min(5).max(284)}).strict(),
}).strict().superRefine((v,ctx)=>{
 if(v.status==='UNAVAILABLE'&&(v.price||v.autoBook||v.autoCalculate))ctx.addIssue({code:'custom',message:'Unavailable work cannot carry a tariff or automation permission'});
 if(v.price?.amount===0&&v.price.kind!=='included')ctx.addIssue({code:'custom',message:'Zero must have an inclusion condition'});
 if(v.price?.kind==='included'&&!v.restrictions&&!v.includes)ctx.addIssue({code:'custom',message:'Inclusion context required'});
 if(v.autoBook&&(!v.autoCalculate||v.managerReview))ctx.addIssue({code:'custom',message:'Invalid booking capability'});
});
export const knowledgeSnapshotSchema=z.object({schemaVersion:z.literal(1),version:z.string().max(80),sourceId:z.literal('1Xua3GrAYAgYfcbYUEWrU6I6cMZEA0IULLdSuKrbW4DY'),sourceHash:z.string().length(64),entries:z.array(knowledgeEntrySchema).min(300).max(650)}).strict();
export type KnowledgeEntry=z.infer<typeof knowledgeEntrySchema>;
export const knowledgeQuerySchema=z.object({query:z.string().trim().min(2).max(400),limit:z.number().int().min(1).max(5).optional()}).strict();
export const knowledgeResultSchema=z.object({version:z.string(),matches:z.array(knowledgeEntrySchema).max(5),truncated:z.boolean(),orderTotals:z.literal('calculatePrice only'),availability:z.literal('slot tools only')}).strict();
