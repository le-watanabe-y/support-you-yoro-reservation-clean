// lib/jpHolidays.ts
import Holidays from "date-holidays";

/**
 * 日本の祝日判定（JSTの当日を判定）
 * - 置換休日・国民の休日も自動対応（date-holidays に準拠）
 */
let hd: Holidays | null = null;
function getHD() {
  if (!hd) {
    hd = new Holidays("JP"); // 言語は既定でOK（nameは英語/日本語混在のことあり）
  }
  return hd!;
}

function toJstDate(dateStr: string): Date {
  // "YYYY-MM-DDT00:00:00+09:00" として生成（JST日付を厳密に判定）
  return new Date(`${dateStr}T00:00:00+09:00`);
}

/** 祝日なら true */
export function isJpHoliday(dateStr: string): boolean {
  const d = toJstDate(dateStr);
  const h = getHD().isHoliday(d);
  return !!h && (Array.isArray(h) ? h.length > 0 : true);
}

/** 祝日の詳細（名前など）。祝日でなければ null */
export function jpHolidayInfo(dateStr: string):
  | { date: string; name: string; type: string }[]
  | null {
  const d = toJstDate(dateStr);
  const h = getHD().isHoliday(d);
  if (!h) return null;
  const arr = Array.isArray(h) ? h : [h];
  return arr.map(x => ({
    date: dateStr,
    name: (x as any).name,
    type: (x as any).type,
  }));
}
