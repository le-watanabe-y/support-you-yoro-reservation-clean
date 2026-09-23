// Japan Standard Time calendar helpers. Server and tests only (date-holidays is large).
import Holidays from 'date-holidays';

const JST_OFFSET = 9 * 3600 * 1000;
const holidays = new Holidays('JP');

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Epoch milliseconds of a JST wall-clock date and HH:MM time.
export const at = (date, time) => Date.parse(`${date}T${time}:00+09:00`);
export const jstDate = clock => new Date(Date.parse(clock) + JST_OFFSET).toISOString().slice(0, 10);
export const jstTime = clock => new Date(Date.parse(clock) + JST_OFFSET).toISOString().slice(11, 16);
export const addDays = (date, days) => new Date(Date.parse(`${date}T12:00:00+09:00`) + days * 86400000 + JST_OFFSET).toISOString().slice(0, 10);

// A real calendar date such as 2026-09-07. Rejects 2026-02-30 and other roll-overs.
export function isCalendarDate(value) {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00+09:00`);
  return Number.isFinite(parsed.getTime()) && jstDate(parsed.toISOString()) === value;
}

export function holidayName(date) {
  const found = holidays.isHoliday(new Date(`${date}T12:00:00+09:00`));
  const list = Array.isArray(found) ? found.filter(h => h.type === 'public') : [];
  return list.length ? list[0].name : '';
}

export const weekday = date => new Date(`${date}T12:00:00+09:00`).getUTCDay();
