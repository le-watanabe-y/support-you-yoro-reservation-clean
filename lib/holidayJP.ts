// lib/holidayJP.ts
import Holidays from "date-holidays";

const hd = new Holidays("JP");

const HOUR = 60 * 60 * 1000;
const JST_OFFSET = 9 * HOUR;

function toJstDate(dateStr: string): Date {
  // 9:00JST を固定して日付ズレを防ぐ
  return new Date(`${dateStr}T09:00:00+09:00`);
}

/** 日本の祝日か？（Date or "YYYY-MM-DD"） */
export function isJapanHoliday(input: Date | string): boolean {
  const d = typeof input === "string" ? toJstDate(input) : input;
  return Boolean(hd.isHoliday(d));
}

/** 祝日名（祝日でなければ null） */
export function japanHolidayName(input: Date | string): string | null {
  const d = typeof input === "string" ? toJstDate(input) : input;
  const info = hd.isHoliday(d) as any;
  if (!info) return null;
  const arr = Array.isArray(info) ? info : [info];
  return arr.map((x: any) => x.name).join(", ");
}
