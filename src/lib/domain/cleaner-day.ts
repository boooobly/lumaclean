import { Temporal } from '@js-temporal/polyfill';
import type { Availability } from './scheduling-conflicts';

export function cleanerDay(active: boolean, rows: Availability[], today = Temporal.Now.plainDateISO('Europe/Belgrade')) {
  if (!active) return 'Неактивен';
  const dated = rows.filter(row => row.date?.toISOString().slice(0, 10) === today.toString());
  if (dated.some(row => row.kind === 'UNAVAILABLE' && row.startMinute === null)) return 'Сегодня выходной';
  const overrides = dated.filter(row => row.kind === 'AVAILABLE');
  const periods = overrides.length ? overrides : rows.filter(row => row.kind === 'WEEKLY' && row.weekday === today.dayOfWeek);
  if (!periods.length) return rows.length ? 'Сегодня нет рабочих часов' : 'График не задан';
  const clock = (minute: number) => `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  return `Сегодня ${periods.map(row => row.startMinute !== null && row.endMinute !== null ? `${clock(row.startMinute)}–${clock(row.endMinute)}` : 'часы не заданы').join(', ')}${dated.some(row => row.kind === 'UNAVAILABLE') ? ' · есть исключение' : ''}`;
}
