import type { AgentLocale } from './contracts';

// Ignore quotations and explicit third-person subjects, rather than rewriting arbitrary words.
export function masculineSelfReference(text: string, locale: AgentLocale) {
  if (locale === 'en') return false;
  const unquoted = text.replace(/«[^»]*»|“[^”]*”|"[^"\n]*"/gu, '');
  return unquoted.split(/(?<=[.!?\n])\s*/u).some(sentence => {
    const clauses = sentence.split(/[,;:]/u);
    return clauses.some(clause => {
      if (locale === 'ru') {
        if (/(?:^|\s)(?:он|клиент|администратор|оператор|муж|вы|ты|я сказал,? что он)\s/iu.test(clause)) return false;
        return /(?:^|\s)(?:я\s+)?(?:понял|передал|проверил|уточнил|нашёл|нашел|записал|сохранил|готов|рад)(?=\s|[.!?—,:;]|$)/iu.test(clause);
      }
      return /\b(?:razumeo|provjerio|proverio|prosledio|pronašao|zapisao)\s+sam\b|(?:^|\s)(?:разумео|проверио|проследио|пронашао|записао)\s+сам(?=\s|[.!?,]|$)/iu.test(clause);
    });
  });
}
export const personaRepairInstruction = 'Rewrite only grammatical self-reference of the LumaClean operator into the established female persona. Preserve all facts, tools, price, time and meaning. Return text only; do not call tools.';
export function repairPreservesFacts(original: string, repaired: string) {
  const tokens = (text: string) => text.match(/\d+(?:[.,:]\d+)*|ORD-[\w-]+|LC-[\w-]+|https?:\/\/\S+/gu) ?? [];
  if(JSON.stringify(tokens(original))!==JSON.stringify(tokens(repaired)))return false;
  const quotes=(text:string)=>text.match(/«[^»]*»|“[^”]*”|"[^"\n]*"/gu)??[];
  if(JSON.stringify(quotes(original))!==JSON.stringify(quotes(repaired)))return false;
  const skeleton=(text:string)=>text.toLowerCase().replace(/(?:^|\s)я\s+/gu,' ').replace(/понял[а]?/gu,'поняла').replace(/передал[а]?/gu,'передала').replace(/проверил[а]?/gu,'проверила').replace(/уточнил[а]?/gu,'уточнила').replace(/наш[её]л[а]?/gu,'нашла').replace(/записал[а]?/gu,'записала').replace(/сохранил[а]?/gu,'сохранила').replace(/готов[а]?/gu,'готова').replace(/рад[а]?/gu,'рада').replace(/proverio|provjerio|proverila|provjerila/gu,'proverila').replace(/razumeo|razumela/gu,'razumela').replace(/prosledio|prosledila/gu,'prosledila').replace(/проверио|проверила/gu,'проверила').replace(/разумео|разумела/gu,'разумела').replace(/проследио|проследила/gu,'проследила').replace(/\s+/gu,' ').trim();
  return skeleton(original)===skeleton(repaired);
}
export const assistantDisclosure: Record<AgentLocale, string> = { ru: 'AI-администратор · Belgrade', 'sr-Latn': 'AI administrator · Beograd', 'sr-Cyrl': 'AI администратор · Београд', en: 'AI assistant · Belgrade' };
export function transparencyAnswer(text: string, locale: AgentLocale, alias: string) {
  if (!/вы (?:бот|человек|ии)|ты (?:бот|человек)|(?:are you|is this) (?:a |an )?(?:human|bot|ai)|(?:da li si|jesi li) (?:bot|čovek|covek|ai)|(?:да ли си|јеси ли) (?:бот|човек)|как (?:вас|тебя) зовут|what(?:'s| is) your name|kako se zoveš|како се зовеш/iu.test(text)) return null;
  return locale === 'ru' ? `Я ${alias}, AI-администратор LumaClean. Могу помочь с уборкой или передать вопрос команде.` : locale === 'en' ? `I'm ${alias}, LumaClean's AI assistant. I can help with cleaning or pass your question to the team.` : locale === 'sr-Cyrl' ? `Ја сам ${alias}, AI администратор LumaClean. Могу да помогнем око чишћења или проследим упит тиму.` : `Ja sam ${alias}, AI administrator LumaClean. Mogu da pomognem oko čišćenja ili prosledim upit timu.`;
}
