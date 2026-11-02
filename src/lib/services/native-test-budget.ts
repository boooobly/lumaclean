import {AsyncLocalStorage} from 'node:async_hooks';

export type NativeTestProfile='diagnostics'|'booking';
type Category='llm'|'places'|'routing';
const limits={diagnostics:{llm:2,places:0,routing:8},booking:{llm:2,places:0,routing:32}} as const;
const scopes=new AsyncLocalStorage<NativeTestBudget>();
export class NativeTestBudgetError extends Error {
  readonly code='NATIVE_TEST_BUDGET_EXCEEDED';
  constructor(){super('NATIVE_TEST_BUDGET_EXCEEDED');this.name='NativeTestBudgetError';}
}
/** Counts before transport. No payload, URL, token or personal data enters the report. */
export class NativeTestBudget {
  private used:Record<Category,number>={llm:0,places:0,routing:0};
  private blocked=false;
  constructor(readonly profile:NativeTestProfile,private routingOrigin:string|null=null){}
  private refuse():never{this.blocked=true;throw new NativeTestBudgetError();}
  authorize(input:Parameters<typeof fetch>[0],init?:RequestInit){
    let url:URL;try{url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);}catch{return this.refuse();}
    let category:Category;
    if(url.protocol==='https:'&&['api.poyo.ai','openrouter.ai'].includes(url.hostname)){
      category='llm';
      // This approved native profile is bound to Luna and the existing1200-token ceiling.
      if((init?.method??'GET').toUpperCase()!=='POST'||typeof init?.body!=='string'||Buffer.byteLength(init.body,'utf8')>(this.profile==='diagnostics'?4096:160000))return this.refuse();
      let body;try{body=JSON.parse(init.body);}catch{return this.refuse();}
      const maximum=body.max_output_tokens??body.max_tokens;
      if(!['gpt-6-luna','openai/gpt-6-luna'].includes(body.model)||!Number.isInteger(maximum)||maximum<1||maximum>1200)return this.refuse();
    }else if(url.protocol==='https:'&&['places.googleapis.com','maps.googleapis.com','routes.googleapis.com'].includes(url.hostname))category='places';
    else if(this.routingOrigin&&url.origin===this.routingOrigin)category='routing';
    else return this.refuse();
    if(this.used[category]>=limits[this.profile][category])return this.refuse();
    this.used[category]++;
  }
  assertAllowed(){if(this.blocked)throw new NativeTestBudgetError();}
  report(){return{profile:this.profile,limits:{...limits[this.profile]},attempted:{...this.used},blocked:this.blocked};}
}
export function currentNativeTestBudget(){return scopes.getStore()?.report();}
export function assertNativeTestBudget(){scopes.getStore()?.assertAllowed();}
export async function withNativeTestBudget<T>(profile:NativeTestProfile,fn:()=>Promise<T>):Promise<T>{
  if(scopes.getStore())throw new Error('NATIVE_TEST_BUDGET_ALREADY_ACTIVE');
  if(process.env.LUMACLEAN_ROUTING_PROVIDER!=='MOTIS')throw new Error('NATIVE_TEST_PROFILE_NOT_APPROVED');
  let origin:string|null=null;try{origin=new URL(process.env.LUMACLEAN_ROUTING_URL??'').origin;}catch{/* Unknown routing stays blocked. */}
  const budget=new NativeTestBudget(profile,origin);
  return scopes.run(budget,async()=>{try{const value=await fn();budget.assertAllowed();return value;}finally{console.info(JSON.stringify({event:'native_test_budget',...budget.report()}));}});
}
/** In normal operation this forwards unchanged. Cached providers retain the scoped guard. */
export const nativeTestFetch:typeof fetch=(input,init)=>{
  scopes.getStore()?.authorize(input,init);
  return globalThis.fetch(input,init);
};
