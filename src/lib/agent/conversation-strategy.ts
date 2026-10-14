import type {AgentState} from './contracts';

export type ConversationStrategy='HYBRID'|'LLM_FIRST';
/** Unknown/missing values fail closed to the existing strategy. No DB migration. */
export function conversationStrategy(value=process.env.AGENT_CONVERSATION_STRATEGY):ConversationStrategy{
 return value==='LLM_FIRST'?'LLM_FIRST':'HYBRID';
}
export const naturalQuestionIntents=new Set<NonNullable<AgentState['nextInput']>>(['SERVICE_TYPE','AREA','SOIL_LEVEL','EXTRAS','WINDOW_COUNTS','WINDOW_TYPE']);
/** Persisted intent must agree with the question's topic; protected intents stay exact. */
export function naturalQuestionMatches(intent:AgentState['nextInput'],text:string){
 if(!intent||!naturalQuestionIntents.has(intent)||!text.includes('?')||text.length>1800||/\d[\d\s.,]*\s*(?:RSD|dinara|динар)|\d\s*%/iu.test(text))return false;
 const topics:Partial<Record<NonNullable<AgentState['nextInput']>,RegExp>>={
  SERVICE_TYPE:/уборк|чищ|clean|čiš|cis|чиш/iu,
  AREA:/площад|квадрат|метр|area|square|m²|m2|kvadrat|površ|povrs|површ/iu,
  SOIL_LEVEL:/загряз|гряз|обыч|сильн|dirt|soil|normal|heavy|zaprl|prlj|запрљ|прљ/iu,
  EXTRAS:/дополн|доп[а-я]* усл|extra|additional|dodat|додат|окн|prozor|прозор|fridge|oven|холодильник|духовк|frižider|rerna|фрижидер|рерна/iu,
  WINDOW_COUNTS:/сколько|количеств|how many|count|koliko|број|колико/iu,
  WINDOW_TYPE:/тип|стандарт|больш|standard|large|type|velik|врст|велик/iu,
 };
 return topics[intent]?.test(text)===true;
}
export const llmFirstInstructions=`CONVERSATION STRATEGY: LLM_FIRST.
Interpret the full latest customer burst together with confirmed facts, the open question and operational memory. Understanding, fact proposals and the next conversational action belong in the same bounded native tool turn. Do not run a separate extraction/planning/composition pipeline. Explicit ingress facts are already saved; do not save them again unless proposing a missing interpretation or correction with exact current CLIENT evidence. Never treat uncertainty as confirmation.
Choose a native action: getBusinessInfo for FAQ, recordCustomerFacts for source-bound missing facts, requestCustomerInput for missing qualification, calculatePrice for a ready quote, estimateDuration/findAvailableSlots for verified scheduling, requestReview for operational exceptions, requestHumanHandoff for hard safety cases. A tool result, including a rejection, is authoritative; continue safely from its concrete missing prerequisite, never repeat a failed action unchanged.
For requestCustomerInput SERVICE_TYPE/AREA/SOIL_LEVEL/EXTRAS/WINDOW_COUNTS/WINDOW_TYPE, provide ONE natural question in the native question argument. The server persists the intent and choices and validates wording. This replaces the default instruction to reproduce qualification templates literally. Never ask a known fact. No price or promise in a qualification question. Other input intents, customer fact-confirmation, slot selection, consent, booking recap and booking result retain exact server wording.
If SERVER PREREQUISITES has missingQualification, collect or clarify it before calculatePrice. Do not infer normal dirt from 'ordinary cleaning'. If leadAlreadySynchronized is true, do not repeat createOrUpdateLead unless new contact facts require it. A question about a date is not a requestedDate fact. Never propose a relative or vague date without exact source evidence; ask the customer. Choose the next missing useful information, not an already known qualification.
Answer the customer's actual question before returning to missing facts. After a successful calculator, explain only its exact returned breakdown, currency, subtotal/review/estimate limitations in natural language; no arithmetic, discount or new amount. Once facts are sufficient, calculate promptly rather than asking them again. Get duration only for a timing/scheduling enquiry; a price enquiry alone does not require duration. If date/address/contact is missing, ask one useful next question without promising a slot. Keep Russian/Serbian/English short and use the established female persona. All existing safety, provenance, identity, review and booking restrictions still apply.`;

export type AnswerOrigin='deterministic-only'|'LLM-generated'|'deterministic quote + LLM response'|'fallback/recovery'|'handoff';
export function answerOrigin(modelComposed:boolean,quoted:boolean,recovery:boolean,handoff:boolean):AnswerOrigin{
 return handoff?'handoff':recovery?'fallback/recovery':!modelComposed?'deterministic-only':quoted?'deterministic quote + LLM response':'LLM-generated';
}
