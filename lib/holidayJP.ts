// lib/holidayJP.ts
import Holidays from "date-holidays";

// 日本の祝日だけを見る
const hd = new Holidays("JP");

const HOUR = 60 * 60 * 1000;
const JST_OFFSET = 9 * HOUR;

// Date -> JST の "YYYY-MM-DD" に正規化
function ymdJST(d: Date): string {
  const j = new Date(d.getTime() + JST_OFFSET);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, "0");
  const day = String(j.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 日本の祝日か？（Date でも "YYYY-MM-DD" でも OK） */
export function isJapanHoliday(input: Date | string): boolean {
  const key = typeof input === "string" ? input : ymdJST(input);
  return Boolean(hd.isHoliday(key));
}
