// lib/jpholiday.ts
import Holidays from "date-holidays";

const hd = new Holidays("JP");

/** "YYYY-MM-DD" を JST 日付に固定（UTCズレ対策） */
function toJstDate(dateStr: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw new Error("YYYY-MM-DD required");
  return new Date(`${dateStr}T09:00:00+09:00`);
}

/** 祝日かどうか（true/false） */
export function isJapanHoliday(dateStr: string): boolean {
  const d = toJstDate(dateStr);
  return Boolean(hd.isHoliday(d));
}

/** 互換エイリアス（以前の呼び名を吸収） */
export const isJpHoliday = isJapanHoliday;

/** 祝日の名称（複数はカンマ結合）。祝日でなければ null */
export function jpHolidayInfo(dateStr: string): { name: string } | null {
  const d = toJstDate(dateStr);
  const info = hd.isHoliday(d) as any;
  if (!info) return null;
  const arr = Array.isArray(info) ? info : [info];
  const name = arr.map((x: any) => x.name).join(", ");
  return { name };
}
