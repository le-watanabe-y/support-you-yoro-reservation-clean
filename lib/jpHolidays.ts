// lib/jpHolidays.ts
import Holidays from 'date-holidays';

const hd = new Holidays('JP');

// "YYYY-MM-DD" か Date を UTC Date へそろえる
function toUtcDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  const [y, m, d] = input.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// 祝日判定（JST）
export function isJapanHoliday(input: Date | string): boolean {
  const date = toUtcDate(input);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  return !!hd.isHoliday(new Date(y, m - 1, d));
}

// 祝日の詳細（名前など）
export function jpHolidayInfo(input: Date | string): { isHoliday: boolean; name?: string; date: string } {
  const date = toUtcDate(input);
  const jst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = jst.getUTCMonth() + 1;
  const d = jst.getUTCDate();
  const res = hd.isHoliday(new Date(y, m - 1, d));

  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  if (Array.isArray(res) && res.length > 0) return { isHoliday: true, name: res[0].name, date: iso };
  if (res && !Array.isArray(res)) return { isHoliday: true, name: (res as any).name, date: iso };
  return { isHoliday: false, date: iso };
}
