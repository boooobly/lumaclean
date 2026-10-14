import {createHash} from 'node:crypto';
import type {AgentState} from './contracts';
import {inputAlreadyKnown} from './chat-presentation';
import {reliabilityCount} from './reliability-telemetry';

export function questionFactsSignature(state:AgentState){
 const f=state.draftFacts??{};
 return createHash('sha256').update(JSON.stringify({service:f.service,area:f.area,soil:f.soilLevel,extras:[...(f.extras??[])].sort((a,b)=>a.code.localeCompare(b.code)),extrasConfirmed:f.extrasConfirmed,windows:f.windowCleaning,applianceScopePending:f.applianceScopePending,date:f.requestedDate})).digest('hex').slice(0,20);
}
export function persistOpenQuestion(state:AgentState,key:NonNullable<AgentState['nextInput']>,messageId:string){
 const signature=questionFactsSignature(state),previous=state.questionContext;
 const attempts=previous?.questionKey===key&&previous.factsSignature===signature?Math.min(previous.attempts+1,10):1;
 if(attempts>1)reliabilityCount(state,'repeatedQuestion');
 state.questionContext={questionKey:key,scope:key==='EXTRAS'||key==='APPLIANCE_SCOPE'?'appliance_inside':key==='BOOKING_CONFIRMATION'?'booking':'qualification',offeredCodes:key==='EXTRAS'?['oven','fridge']:key==='APPLIANCE_SCOPE'?state.draftFacts?.applianceScopePending?.map(e=>e.code):undefined,askedAtMessageId:messageId,status:'OPEN',factsSignature:signature,attempts};
}
export function resolveOpenQuestion(state:AgentState){
 const q=state.questionContext;
 if(q?.status==='OPEN'&&inputAlreadyKnown(q.questionKey,state))q.status='ANSWERED';
}
export function loopSignal(state:AgentState,text:string){
 return /я (?:же )?(?:уже )?(?:писал|написал|ответил)|уже (?:писал|написал|ответил)|как (?:я )?писал|already (?:said|answered|told)|as i said|vec sam|већ сам|kao sto sam|као што сам/iu.test(text)||!!state.questionContext&&state.questionContext.status==='OPEN'&&state.questionContext.attempts>=2&&state.questionContext.factsSignature===questionFactsSignature(state);
}
export function customerPriceRequest(text:string){return /сколько.{0,60}(?:сто|все|всё|вместе)|какая.{0,25}цен|what.{0,25}(?:price|cost)|how much|koliko.{0,35}(?:kosta|košta|sve|cena)|колико.{0,35}(?:кошта|све|цена)/iu.test(text);}
