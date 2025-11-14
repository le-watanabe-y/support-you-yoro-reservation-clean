// lib/jpHolidays.ts
import Holidays from "date-holidays";

/** 日本の祝日かどうか（YYYY-MM-DD を渡す） */
export function isJpHoliday(yyyyMmDd: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(yyyyMmDd);
  if (!m) return false;
  const [_, y, mo, d] = m;
  const hd = new Holidays("JP");
  return !!hd.isHoliday(new Date(Number(y), Number(mo) - 1, Number(d)));
}
