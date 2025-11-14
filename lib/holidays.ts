// lib/jpHolidays.ts
import Holidays from "date-holidays";

const hd = new Holidays("JP");

function toDateJst(input: string | Date): Date {
  if (input instanceof Date) return new Date(input.getTime());
  // 文字列は JST 暦日として扱う
  return new Date(`${input}T00:00:00+09:00`);
}

/** 祝日かどうか（真偽値） */
export function isJapanHoliday(input: string | Date): boolean {
  return Boolean(hd.isHoliday(toDateJst(input)));
}

/** 祝日の詳しい情報（名称など）。祝日でなければ null */
export function jpHolidayInfo(input: string | Date) {
  return hd.isHoliday(toDateJst(input)) || null;
}
