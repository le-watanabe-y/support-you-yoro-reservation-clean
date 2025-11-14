// lib/jpholiday.ts
// 日本の祝日判定（date-holidays を利用）

import Holidays from "date-holidays";

/** date-holidays の JP カレンダを 1 度だけ初期化 */
const hd = new Holidays("JP");

/**
 * YYYY-MM-DD を受け取り、その日が日本の祝日なら true
 * ・振替休日/国民の休日も包含
 * ・TZ ずれを避けるため UTC 日付で評価
 */
export function isJapanHoliday(dateStr: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr ?? "");
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);

  // UTC 00:00 で Date を作り判定（JST ずれ対策）
  const res = hd.isHoliday(new Date(Date.UTC(y, mo - 1, d)));
  return !!res;
}
