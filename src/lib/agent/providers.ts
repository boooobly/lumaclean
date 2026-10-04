import { z } from "zod";
import { AgentError, type ToolName, nativeTools } from "./contracts";

export type ToolCall = {id:string;name:ToolName;arguments:string};
export type AgentMessage = {role:"system"|"user"|"assistant"|"tool";content:string;images?:{mimeType:'image/jpeg';data:string}[];toolCalls?:ToolCall[];toolCallId?:string};
export type Completion = {text:string;toolCalls:ToolCall[];inputTokens:number;cachedInputTokens:number;outputTokens:number;latencyMs:number;provider:string;model:string;estimatedCostUsd:number|null};
export interface AIProvider { readonly name:string; readonly model:string; complete(messages:AgentMessage[],signal?:AbortSignal):Promise<Completion>; }
const wireTool = z.object({id:z.string().min(1).max(200),function:z.object({name:z.string().max(100),arguments:z.string().max(8000)})});
const wireMessage = z.object({content:z.string().nullable().optional(),tool_calls:z.array(wireTool).max(8).optional()});
const tokens=z.number().int().nonnegative().max(1000000);
const usageSchema=z.object({prompt_tokens:tokens.optional(),input_tokens:tokens.optional(),completion_tokens:tokens.optional(),output_tokens:tokens.optional(),prompt_tokens_details:z.object({cached_tokens:tokens.optional()}).optional(),input_tokens_details:z.object({cached_tokens:tokens.optional()}).optional()});
const chatSchema=z.object({model:z.string().optional(),choices:z.array(z.object({message:wireMessage,finish_reason:z.string().optional()})).min(1),usage:usageSchema.optional()});
const responseSchema=z.object({model:z.string().optional(),status:z.string().optional(),output:z.array(z.object({type:z.string(),call_id:z.string().optional(),name:z.string().optional(),arguments:z.string().optional(),content:z.array(z.object({type:z.string(),text:z.string().optional()})).optional()})).max(30),usage:usageSchema.optional()});
export function normalizeCompletion(provider:string,model:string,protocol:"chat"|"responses",raw:unknown,latencyMs:number,rates?:{input:number;output:number}):Completion {
  const envelope=z.object({data:z.unknown().optional(),code:z.number().optional()}).passthrough().parse(raw);
  if(envelope.code!==undefined&&envelope.code!==200)throw new AgentError("PROVIDER_REJECTED");
  const data=envelope.data??raw;
  let text:string, calls:ToolCall[], usage:z.infer<typeof usageSchema>;
  if(protocol==="chat"){
    const result=chatSchema.parse(data),m=result.choices[0].message;
    if(result.choices[0].finish_reason==="length")throw new AgentError("PROVIDER_TRUNCATED");
    text=m.content??"";calls=(m.tool_calls??[]).map(c=>({id:c.id,name:c.function.name as ToolName,arguments:c.function.arguments}));usage=result.usage??{};
  }else{
    const result=responseSchema.parse(data);
    if(result.status&&result.status!=="completed")throw new AgentError("PROVIDER_INCOMPLETE");
    text=result.output.filter(o=>o.type==="message").flatMap(o=>(o.content??[]).filter(c=>c.type==="output_text").map(c=>c.text??"")).join("");
    calls=result.output.filter(o=>o.type==="function_call").map(o=>{if(!o.call_id||!o.name||o.arguments===undefined)throw new AgentError("PROVIDER_MALFORMED");return{id:o.call_id,name:o.name as ToolName,arguments:o.arguments};});usage=result.usage??{};
  }
  if(text.length>4000||calls.length>8||(!text.trim()&&!calls.length))throw new AgentError("PROVIDER_MALFORMED");
  const inputTokens=usage.prompt_tokens??usage.input_tokens??0,outputTokens=usage.completion_tokens??usage.output_tokens??0;
  // Intentionally discard all reasoning, encrypted reasoning and provider error payloads.
  return {text,toolCalls:calls,inputTokens,outputTokens,cachedInputTokens:usage.prompt_tokens_details?.cached_tokens??usage.input_tokens_details?.cached_tokens??0,latencyMs,provider,model,estimatedCostUsd:rates?(inputTokens*rates.input+outputTokens*rates.output)/1e6:null};
}
abstract class HTTPProvider implements AIProvider {
  abstract readonly name:string;
  constructor(readonly model:string,protected key:string,protected send:typeof fetch=fetch,protected rates?:{input:number;output:number}){}
  protected async request(url:string,body:unknown,protocol:"chat"|"responses",signal?:AbortSignal){
    if(!this.key)throw new AgentError("PROVIDER_UNCONFIGURED");
    const started=Date.now();
    try{
      const r=await this.send(url,{method:"POST",headers:{Authorization:"Bearer "+this.key,"Content-Type":"application/json"},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(22000)]):AbortSignal.timeout(22000),cache:"no-store"});
      if(!r.ok)throw new AgentError("PROVIDER_HTTP_"+r.status);
      const payload=await r.text();if(payload.length>200000)throw new AgentError("PROVIDER_TOO_LARGE");
      return normalizeCompletion(this.name,this.model,protocol,JSON.parse(payload),Date.now()-started,this.rates);
    }catch(e){if(e instanceof AgentError)throw e;throw new AgentError(e instanceof z.ZodError?"PROVIDER_MALFORMED":"PROVIDER_TIMEOUT_OR_NETWORK");}
  }
  abstract complete(messages:AgentMessage[],signal?:AbortSignal):Promise<Completion>;
}
export class OpenRouterProvider extends HTTPProvider {
  readonly name="openrouter";
  complete(messages:AgentMessage[],signal?:AbortSignal){return this.request("https://openrouter.ai/api/v1/chat/completions",{model:this.model,messages:messages.map(m=>({role:m.role,content:m.images?.length?[{type:'text',text:m.content},...m.images.map(i=>({type:'image_url',image_url:{url:`data:${i.mimeType};base64,${i.data}`}}))]:m.content,...(m.toolCallId?{tool_call_id:m.toolCallId}:{}),...(m.toolCalls?{tool_calls:m.toolCalls.map(c=>({id:c.id,type:"function",function:{name:c.name,arguments:c.arguments}}))}:{})})),tools:nativeTools,max_tokens:1200,provider:{require_parameters:true}},"chat",signal);}
}
export class PoyoProvider extends HTTPProvider {
  readonly name="poyo";
  // Native Responses function calling, never parse pseudo-tool JSON from plain text.
  complete(messages:AgentMessage[],signal?:AbortSignal){
    const input=messages.flatMap<Record<string,unknown>>(m=>m.role==="tool"?[{type:"function_call_output",call_id:m.toolCallId,output:m.content}]:m.toolCalls?m.toolCalls.map(c=>({type:"function_call",call_id:c.id,name:c.name,arguments:c.arguments})):[{role:m.role,content:m.images?.length?[{type:'input_text',text:m.content},...m.images.map(i=>({type:'input_image',image_url:`data:${i.mimeType};base64,${i.data}`,detail:'auto'}))]:m.content}]);
    return this.request("https://api.poyo.ai/v1/responses",{model:this.model,input,tools:nativeTools.map(t=>({type:"function",...t.function})),max_output_tokens:1200,parallel_tool_calls:false,reasoning:{effort:"low"},store:false},"responses",signal);
  }
}
export function configuredProviders():[AIProvider,AIProvider]{
  const make=(prefix:"PRIMARY"|"FALLBACK")=>{
    const provider=process.env[`${prefix}_AGENT_PROVIDER`],model=process.env[`${prefix}_AGENT_MODEL`];
    if(!model||!['openrouter','poyo'].includes(provider??""))throw new AgentError("PROVIDER_UNCONFIGURED");
    const input=Number(process.env[`${prefix}_AGENT_INPUT_USD_PER_MILLION`]),output=Number(process.env[`${prefix}_AGENT_OUTPUT_USD_PER_MILLION`]);
    const rates=Number.isFinite(input)&&Number.isFinite(output)&&input>=0&&output>=0?{input,output}:undefined;
    return provider==="poyo"?new PoyoProvider(model,process.env.POYO_API_KEY??"",fetch,rates):new OpenRouterProvider(model,process.env.OPENROUTER_API_KEY??"",fetch,rates);
  };return[make("PRIMARY"),make("FALLBACK")];
}
