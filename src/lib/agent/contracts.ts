import { z } from "zod";
import { serviceIds } from "@/lib/pricing";
import { extrasSchema } from "@/lib/validation/crm";

export const locales = ["ru", "sr-Latn", "sr-Cyrl", "en"] as const;
export type AgentLocale = (typeof locales)[number];
export const reasons = ["COMPLAINT", "DISCOUNT", "OUT_OF_SCOPE", "MOLD", "RENOVATION", "AMBIGUOUS", "PRICE_REVIEW", "NO_DURATION_RULE", "ROUTING_UNRELIABLE", "NO_SLOTS", "TOOL_ERRORS", "IDENTITY_REQUIRED", "UNCERTAINTY"] as const;
export type HandoffReason = (typeof reasons)[number];
export const qualificationSchema = z.object({
  service: z.enum(serviceIds), area: z.number().finite().min(1).max(1000),
  extras: extrasSchema, soilLevel: z.enum(["LIGHT","NORMAL","HEAVY","EXTREME"]), urgent: z.boolean(),
}).strict();
const empty = z.object({}).strict();
export const toolSchemas = {
  getBusinessInfo: empty,
  findClient: empty,
  createOrUpdateLead: z.object({intent:z.literal("cleaning"),name:z.string().trim().min(2).max(100).optional(),phone:z.string().trim().min(6).max(40).optional(),service:z.enum(serviceIds).optional(),area:z.number().finite().min(1).max(1000).optional()}).strict(),
  calculatePrice: qualificationSchema,
  estimateDuration: empty,
  resolveAddress: z.object({query:z.string().trim().min(3).max(200),placeId:z.string().min(1).max(300).optional(),apartment:z.string().max(60).optional()}).strict(),
  getClientAddresses: z.object({addressId:z.string().max(80).optional()}).strict(),
  findAvailableSlots: z.object({date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),from:z.string().max(30),to:z.string().max(30)}).strict(),
  validateSlot: z.object({slotToken:z.uuid()}).strict(),
  createOrder: empty,
  rescheduleOrder: empty,
  requestHumanHandoff: z.object({reason:z.enum(reasons)}).strict(),
};
export type ToolName = keyof typeof toolSchemas;
export const toolDescriptions:Record<ToolName,string> = {
  getBusinessInfo:"Read current public facts and FAQ, services, extras and exclusions. Must use for business questions.",
  findClient:"Read only the server-verified identity bound to this conversation. Phone or display name claims are NOT verification. Never accepts arbitrary client ID.",
  createOrUpdateLead:"Create/update substantive cleaning inquiry immediately. ONLY intent is required; name/phone are OPTIONAL. Never wait for contact to record intent. Contact may be gathered later, do not invent it. No lead for a greeting or isolated FAQ.",
  calculatePrice:"Authoritative production price. Needs explicit service, area, soil, extras (empty means customer wants no extras), urgent. Contact is NOT required. Save current quote; invalidates old duration and slot. If requiresHumanReview, handoff.",
  estimateDuration:"Calculate current quote's duration from active owner rules and choose crew size from applicable rules. Missing rule means handoff, no guessed duration.",
  resolveAddress:"Address search. First call query only; ask customer to choose candidate. Then pass ONLY a returned placeId to confirm coordinates. Unavailable search or ambiguous address: ask or handoff. Apartment may be supplied separately.",
  getClientAddresses:"Read bound verified client's own active addresses, no notes/intercom/internal info. Optional returned addressId selects an address for current request.",
  findAvailableSlots:"Check real calendar, crew and routes using current quote, duration and verified address. date/from/to use Belgrade wall times YYYY-MM-DDTHH:mm. Maximum three slots, never invent a time. For rescheduling requires verified current order.",
  validateSlot:"Select a returned scoped opaque slot, revalidate calendar/routing and produce recap. This is selection, not booking confirmation. Send recap and request explicit customer confirmation. Get name and valid phone before calling.",
  createOrder:"Create standard confirmed order from CURRENT server recap ONLY when subsequent customer message or confirmation button has explicitly confirmed that recap. Empty args: cannot supply price/team/client/confirmation. Server locks and rechecks all facts and scheduling.",
  rescheduleOrder:"Move ONLY current conversation's existing order, after explicit request to reschedule, verified identity, fresh validated recap and explicit confirmation. No override or completed orders.",
  requestHumanHandoff:"Escalate complaint, discount, mold, renovation, unavailable rules/routes/prices, repeated errors or uncertainty. Never solve exceptional cases or claim a booking that failed.",
};
// Responses otherwise normalizes optional contact fields into required fields.
// Argument validation remains strict on the server, including rejection of extra fields.
export const nativeTools = Object.entries(toolSchemas).map(([name,schema])=>({type:"function" as const,function:{name,description:toolDescriptions[name as ToolName],strict:false,parameters:z.toJSONSchema(schema,{target:"draft-7"})}}));
export type Qualification = z.infer<typeof qualificationSchema>;
export type AgentState = {
  name?:string; phone?:string; qualification?:Qualification;
  quote?:{id:string;serviceId:string;input:Qualification;total:number;base:number;discountPercent:number;requiresHumanReview:boolean;at:string};
  duration?:{minutes:number;reserve:number;requiredCleaners:number;ruleId:string;version:number};
  address?:{fullAddress:string;proof?:string;addressId?:string;apartment?:string};
  addressCandidates?:{placeId:string;text:string;query?:string}[];
  requestedWindow?:{date:string;from:string;to:string};
  slots?:{token:string;start:string;duration:number}[];
  pending?:{slotToken:string;nonce:string;confirmedByMessageId?:string;recap:BookingRecap;reschedule:boolean};
  booking?:BookingRecap & {reference:string;orderId:string};
  rescheduleRequested?:boolean;
};
export type BookingRecap = {service:string;area:number;extras:{code:string;quantity:number}[];address:string;start:string;durationMinutes:number;price:number;currency:"RSD"};
export type ToolResult = Record<string,unknown>;
export class AgentError extends Error {
  constructor(public code:string){super(code);this.name="AgentError";}
}
export const publicInboundSchema = z.discriminatedUnion("action",[
  z.object({action:z.literal("start"),locale:z.enum(locales)}).strict(),
  z.object({action:z.literal("message"),id:z.uuid(),text:z.string().trim().min(1).max(1500),locale:z.enum(locales),confirmationNonce:z.uuid().optional()}).strict(),
]);
