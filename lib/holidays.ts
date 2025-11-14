// lib/holidays.ts
import Holidays from "date-holidays";

/**
 * 日本の祝日判定（振替休日・国民の休日を含む）
 * 文字列 "YYYY-MM-DD" を直接渡して日付単位で判定します。
 */
const hd = new Holidays("JP");

export function isJapaneseHoliday(yyyy_mm_dd: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(yyyy_mm_dd)) return false;
  const ret = hd.isHoliday(yyyy_mm_dd as any); // date-holidays は文字列でもOK
  return !!ret; // 祝日ならオブジェクト/配列、平日なら null/false
}
