// lib/jpholiday.ts
// 祝日判定ユーティリティ（date-holidays を使用）
// どちらの関数名でも使えるように alias を用意：
//   isJapanHoliday / isJapaneseHoliday

import Holidays from "date-holidays";

const hd = new Holidays("JP");

// "YYYY-MM-DD" -> [y, m, d]
function ymd(dateStr: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? "");
  if (!m) throw new Error("Invalid date (YYYY-MM-DD expected)");
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/**
 * 指定日が日本の祝日なら true
 * 判定は JST の暦日基準になるよう、UTC で日付を固定して渡す
 */
export function isJapanHoliday(dateStr: string): boolean {
  const [y, mo, d] = ymd(dateStr);
  // JST 00:00 相当の時刻になるよう UTC を調整（±は細かい影響を避けるため 00:00 指定）
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
  return !!hd.isHoliday(dt);
}

// 互換エイリアス（どちらの import 名でも動作させる）
export const isJapaneseHoliday = isJapanHoliday;
