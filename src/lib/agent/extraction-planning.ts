import type {AgentState} from './contracts';
import {catalogQuestion} from './conversion-facts';
type Facts=NonNullable<AgentState['draftFacts']>;
/** Cheap completeness signal only. A model proposal still needs source evidence/customer confirmation. */
export function needsStructuredExtraction(text:string,key:AgentState['nextInput'],incoming:Facts){
 if(incoming.serviceConfirmationRequired)return false;
 if(incoming.applianceScopePending?.length)return false;
 if(!key||!['SERVICE_TYPE','SERVICE_CONFIRMATION','AREA','SOIL_LEVEL','EXTRAS','WINDOW_COUNTS','WINDOW_TYPE'].includes(key)||catalogQuestion(text))return false;
 if(/^(?:да|нет|yes|no|da|ne|спасибо|thanks|hvala|хвала|я уже ответил|да, я же написал)[.!\s]*$/iu.test(text.trim()))return false;
 const knownKey=key==='AREA'?'area':key==='SOIL_LEVEL'?'soilLevel':key==='SERVICE_TYPE'||key==='SERVICE_CONFIRMATION'?'service':key==='WINDOW_COUNTS'||key==='WINDOW_TYPE'?'windowCleaning':'extrasConfirmed';
 if(key==='EXTRAS'){
  const body=text.split(/[.?!]/u)[0].replace(/^(?:да|yes|da|здравствуйте|hello|hi)[,\s]+/iu,'');
  const separators=(body.match(/\s(?:и|and|i|и)\s|,/giu)??[]).length;
  const knownItems=(incoming.extras?.length??0)+(incoming.declinedExtras?.length??0)+['area','service','soilLevel','bathroomCount','windowCleaning'].filter(k=>incoming[k as keyof Facts]!==undefined).length+(incoming.extrasConfirmed&&!incoming.extras?.length&&!incoming.declinedExtras?.length?1:0);
  if(separators>0&&knownItems>0&&knownItems<=separators)return true;
 }
 if(key==='EXTRAS'&&incoming.windowCleaning)return false; // The window planner asks for missing counts/type.
 if(incoming[knownKey as keyof Facts]!==undefined)return false;
 if(Object.keys(incoming).some(k=>['phone','name','addressQuery','city','neighborhoodHint','requestedDate','requestedWeekend','preferredContactChannel'].includes(k)))return false;
 return text.trim().length>=4;
}
