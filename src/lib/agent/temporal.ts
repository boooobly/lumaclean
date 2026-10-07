import { Temporal } from '@js-temporal/polyfill';

export type TemporalSettings = { timezone: string; sameDayBookingCutoffMinute?: number; latestCleanerDepartureMinute?: number };
export const wallMinute = (minute: number) => `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;
export function buildAgentTemporalContext(messageReceived: Date, settings: TemporalSettings, now = new Date()) {
  const message = Temporal.Instant.from(messageReceived.toISOString()).toZonedDateTimeISO(settings.timezone);
  const local = Temporal.Instant.from(now.toISOString()).toZonedDateTimeISO(settings.timezone);
  const allowed = local.hour * 60 + local.minute < (settings.sameDayBookingCutoffMinute ?? 1020);
  return { messageReceivedInstant: messageReceived.toISOString(), messageLocalDate: message.toPlainDate().toString(), messageLocalTime: message.toPlainTime().toString(), nowInstant: now.toISOString(), nowLocalDate: local.toPlainDate().toString(), nowLocalTime: local.toPlainTime().toString(), dayOfWeek: local.dayOfWeek, timezone: settings.timezone, sameDayBookingCutoff: wallMinute(settings.sameDayBookingCutoffMinute ?? 1020), sameDayBookingAllowedNow: allowed, earliestPotentialServiceDate: local.toPlainDate().add({ days: allowed ? 0 : 1 }).toString(), latestCleanerDepartureTime: wallMinute(settings.latestCleanerDepartureMinute ?? 1020) };
}
export function serviceDatePolicy(date: string, settings: TemporalSettings, now = new Date()) {
  const context = buildAgentTemporalContext(now, settings, now);
  Temporal.PlainDate.from(date); // Validate before comparing ISO dates.
  if (date < context.nowLocalDate) return { error: 'PAST_SERVICE_DATE', earliestDate: context.earliestPotentialServiceDate } as const;
  if (date === context.nowLocalDate && !context.sameDayBookingAllowedNow) return { error: 'SAME_DAY_CUTOFF', earliestDate: context.earliestPotentialServiceDate } as const;
  return { urgent: date === context.nowLocalDate } as const;
}
const weekdays = [
  /\b(?:monday|ponedeljak)\b|понедельник|понедељак/iu,
  /\b(?:tuesday|utorak)\b|вторник|уторак/iu,
  /\b(?:wednesday|sreda|srijeda)\b|сред[ау]|сриједа/iu,
  /\b(?:thursday|četvrtak|cetvrtak)\b|четверг|четвртак/iu,
  /\b(?:friday|petak)\b|пятниц|петак/iu,
  /\b(?:saturday|subot[au])\b|суббот|субот[ау]/iu,
  /\b(?:sunday|nedelj[au]|nedjelj[au])\b|воскресень|недељ[ау]/iu,
];
export function resolveCustomerWeekend(text:string,messageReceived:Date,timezone:string) {
  if(!/ovog vikenda|овог викенда|this weekend|(?:в эти|на этих|этих|эти) выходн/iu.test(text))return undefined;
  const day=Temporal.Instant.from(messageReceived.toISOString()).toZonedDateTimeISO(timezone).toPlainDate();
  const saturday=day.add({days:6-day.dayOfWeek});
  return{saturday:saturday.toString(),sunday:saturday.add({days:1}).toString()};
}
/** Interpretation is anchored to the CLIENT message, never to delayed job execution. */
export function resolveCustomerDate(text: string, messageReceived: Date, timezone: string): string | undefined {
  const day = Temporal.Instant.from(messageReceived.toISOString()).toZonedDateTimeISO(timezone).toPlainDate();
  const explicit = text.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (explicit) { try { return Temporal.PlainDate.from(explicit).toString(); } catch { return undefined; } }
  if (/послезавтра|прекосутра|\b(?:prekosutra|day after tomorrow)\b/iu.test(text)) return day.add({ days: 2 }).toString();
  if (/завтра|сутра|\b(?:sutra|tomorrow)\b/iu.test(text)) return day.add({ days: 1 }).toString();
  if (/сегодня|данас|\b(?:danas|today)\b/iu.test(text)) return day.toString();
  const index = weekdays.findIndex(pattern => pattern.test(text));
  if (index < 0) return undefined;
  const next = /следующ|следећ|\b(?:next|sledeć|sledec)/iu.test(text);
  let distance = (index + 1 - day.dayOfWeek + 7) % 7;
  // "This" names the current calendar week. "Next" names the following week.
  if (next) distance = index + 1 - day.dayOfWeek + 7;
  else if (/эту|этот|ове|ову|\b(?:this|ove|ovu)\b/iu.test(text)) distance = index + 1 - day.dayOfWeek;
  return day.add({ days: distance }).toString();
}
export function departurePolicy(departure: string | null, serviceDate: string, settings: TemporalSettings, now = new Date(), previous?: { status: string; end: string | null }) {
  if (!departure) return { error: 'DEPARTURE_UNVERIFIED' } as const;
  const instant = Temporal.Instant.from(departure), local = instant.toZonedDateTimeISO(settings.timezone);
  if (local.toPlainDate().toString() !== serviceDate || local.hour * 60 + local.minute >= (settings.latestCleanerDepartureMinute ?? 1020)) return { error: 'LATEST_DEPARTURE_EXCEEDED' } as const;
  const today = buildAgentTemporalContext(now, settings, now).nowLocalDate;
  if (serviceDate === today) {
    if (instant.epochMilliseconds < now.getTime()) return { error: 'PAST_DEPARTURE' } as const;
    // A planned finish in the past is not evidence that the crew has reached that address.
    if (previous && previous.status !== 'COMPLETED' && (!previous.end || Date.parse(previous.end) < now.getTime())) return { error: 'CURRENT_CREW_POSITION_UNVERIFIED' } as const;
  }
  return { allowed: true } as const;
}
export function latestStartForEndBy(endBy: string, durationMinutes: number, timezone: string) {
  return Temporal.PlainDateTime.from(endBy).toZonedDateTime(timezone, { disambiguation: 'reject' }).subtract({ minutes: durationMinutes }).toPlainDateTime().toString({ smallestUnit: 'minute' });
}
export type DepartureLegInput={departure:string|null;start:string;travelSeconds:number;bufferMinutes:number;previous?:{status:string;end:string|null}};
/** A completed previous job establishes an origin. A planned finish alone does not. */
export function incomingDeparturePolicy(leg:DepartureLegInput,date:string,settings:TemporalSettings,now=new Date()){
  let departure=leg.departure;
  if(leg.previous?.status==='COMPLETED'&&departure&&Date.parse(departure)<now.getTime())departure=now.toISOString();
  if(departure&&leg.previous&&Date.parse(departure)+leg.travelSeconds*1000+leg.bufferMinutes*60000>Date.parse(leg.start))return{error:'PAST_DEPARTURE'} as const;
  return departurePolicy(departure,date,settings,now,leg.previous);
}
