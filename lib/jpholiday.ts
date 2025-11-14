// /lib/jpholiday.ts
// date-holidays を使って日本の祝日判定を提供します
import Holidays from "date-holidays";

export type JpHolidayInfo =
  | { ok: true; holiday: true; name: string | null }
  | { ok: true; holiday: false; name: null }
  | { ok: false; holiday: false; name: null };

// ライブラリのインスタンス（日本の祝日）
const hd = new Holidays("JP");

/** 日本の祝日なら true を返す（正式名） */
export function isJapaneseHoliday(date: Date): boolean {
  try {
    const res = hd.isHoliday(date);
    if (!res) return false;
    return Array.isArray(res) ? res.length > 0 : true;
  } catch {
    return false;
  }
}

/** 互換用エイリアス（既存コードが参照） */
export const isJapanHoliday = isJapaneseHoliday;

/** 判定結果の詳細（名称つき） */
export function jpHolidayInfo(date: Date): JpHolidayInfo {
  try {
    const res = hd.isHoliday(date);
    if (!res) return { ok: true, holiday: false, name: null };
    const one = Array.isArray(res) ? res[0] : res;
    return { ok: true, holiday: true, name: (one as any)?.name ?? null };
  } catch {
    return { ok: false, holiday: false, name: null };
  }
}
