import { randomInt } from "node:crypto";
import type { AgentLocale, AgentState } from "./contracts";
export const displayAliases = [
  "Anna",
  "Sofia",
  "Mila",
  "Elena",
  "Nina",
  "Maria",
  "Sara",
  "Maya",
  "Natalia",
  "Aleksandra",
] as const;
export function chooseAlias(recent: readonly string[] = []) {
  const choices = displayAliases.filter((a) => !recent.slice(0, 3).includes(a));
  return choices[randomInt(choices.length)];
}
const replies = {
  SERVICE_REGULAR: [
    "Обычная уборка",
    "Redovno čišćenje",
    "Редовно чишћење",
    "Regular cleaning",
  ],
  SERVICE_DEEP: [
    "Генеральная уборка",
    "Dubinsko čišćenje",
    "Дубинско чишћење",
    "Deep cleaning",
  ],
  SERVICE_MOVE: [
    "При переезде",
    "Čišćenje pri selidbi",
    "Чишћење при селидби",
    "Move cleaning",
  ],
  SOIL_NORMAL: [
    "Обычное загрязнение",
    "Uobičajena zaprljanost",
    "Уобичајена запрљаност",
    "Normal dirt",
  ],
  SOIL_HEAVY: [
    "Сильное загрязнение",
    "Jaka zaprljanost",
    "Јака запрљаност",
    "Heavy dirt",
  ],
  NO_EXTRAS: [
    "Без дополнительных услуг",
    "Bez dodatnih usluga",
    "Без додатних услуга",
    "No extras",
  ],
  YES: ["Да", "Da", "Да", "Yes"],
  NO: ["Нет", "Ne", "Не", "No"],
} as const;
export type ReplyKey = keyof typeof replies;
const languages: AgentLocale[] = ["ru", "sr-Latn", "sr-Cyrl", "en"];
export function replyText(key: ReplyKey, locale: string) {
  return replies[key][Math.max(0, languages.indexOf(locale as AgentLocale))];
}
export type QuickReply = { key: string; label: string };
/** Only questions in the current delivered answer may expose allowed choices. */
export function quickReplies(
  text: string,
  state: AgentState,
  locale: string,
  control: string,
): QuickReply[] {
  if (
    control !== "AI_CONTROL" ||
    state.pending ||
    state.booking ||
    !/[?？]/u.test(text)
  )
    return [];
  const keys: ReplyKey[] =
    /загрязн|гряз|zaprljan|prljav|запрљан|прљав|soil|dirt/i.test(text)
      ? ["SOIL_NORMAL", "SOIL_HEAVY"]
      : /дополнительн|дополнени|dodatn|додатн|extras/i.test(text)
        ? ["NO_EXTRAS"]
        : /какая уборка|тип уборки|обычн.*генеральн|redovno.*dubinsko|редовно.*дубинско|regular.*deep|which.*cleaning|what.*cleaning/i.test(
              text,
            )
          ? ["SERVICE_REGULAR", "SERVICE_DEEP", "SERVICE_MOVE"]
          : [];
  const choices: QuickReply[] = keys.map((key) => ({
    key,
    label: replyText(key, locale),
  }));
  if (
    state.slots &&
    !state.pending &&
    /время|слот|termin|термин|time|slot/i.test(text)
  )
    choices.push(
      ...state.slots
        .slice(0, 3)
        .map((s) => ({
          key: `SLOT:${s.token}`,
          label: new Intl.DateTimeFormat(
            locale === "sr-Cyrl"
              ? "sr-RS"
              : locale === "sr-Latn"
                ? "sr-Latn-RS"
                : locale,
            {
              timeZone: "Europe/Belgrade",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            },
          ).format(new Date(s.start)),
        })),
    );
  return choices;
}
export function isReplyKey(key: string): key is ReplyKey {
  return Object.hasOwn(replies, key);
}
