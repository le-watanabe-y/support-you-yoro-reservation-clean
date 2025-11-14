// lib/jpholiday.ts
import Holidays from "date-holidays";

// 日本の祝日カレンダー（ローカル無しで使える）
const hd = new Holidays("JP");

/** "YYYY-MM-DD" を渡すと祝日なら true */
export function isJapaneseHoliday(dateStr: string): boolean {
  return Boolean(hd.isHoliday(dateStr));
}

/** 祝日メタ（なければ null） */
export function jpHolidayInfo(
  dateStr: string
): { name: string; type?: string } | null {
  const info = hd.isHoliday(dateStr);
  if (!info) return null;
  const first = Array.isArray(info) ? info[0] : info;
  return { name: first.name, type: first.type };
}
