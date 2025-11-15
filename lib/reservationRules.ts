// lib/reservationRules.ts
// 祝日判定（既存の実装名に合わせて必要なら変更）
import { isJapanHoliday } from "@/lib/jpHolidays"; // 例: "@/lib/holidayJP" 等にしているなら合わせてください

/** 上限・定員カウント対象 */
export const LIMIT_DAILY = 6 as const;
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;
export type Period = keyof typeof LIMIT_BY_PERIOD; // 'am' | 'pm'
export const COUNT_STATUSES = ["pending", "approved"] as const;

/** JST の「今」 */
function nowInJST(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  return new Date(s);
}

/** YYYY-MM-DD */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' を JST の 00:00 として解釈 */
export function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00+09:00`);
}

/** 'HH:mm' → 'am' | 'pm' */
export function slotFromTimeStr(time?: string | null): Period {
  if (!time) return "am";
  const [h] = time.split(":").map(Number);
  return Number.isFinite(h) && h >= 12 ? "pm" : "am";
}

/** 互換用（既存ルートが参照している名前） */
export function toPeriodFromTime(time?: string | null): Period {
  return slotFromTimeStr(time);
}

/** 休園日：土日祝・年末年始（12/29〜1/4） */
export function isClosedDate(dateStr: string): boolean {
  // JST の真昼 09:00 を使うと曜日ずれが起きにくい
  const dow = new Date(`${dateStr}T09:00:00+09:00`).getUTCDay(); // 0=日,6=土
  const weekend = dow === 0 || dow === 6;

  const [, mStr, dStr] = dateStr.split("-");
  const m = Number(mStr), d = Number(dStr);
  const yearend = (m === 12 && d >= 29) || (m === 1 && d <= 4);

  const holiday = (() => {
    try { return !!isJapanHoliday?.(dateStr); } catch { return false; }
  })();

  return weekend || holiday || yearend;
}

/** 受付ウィンドウ
 *  - 00:00〜11:59 JST: 当日だけ受付
 *  - 12:00〜23:59 JST: 翌日だけ受付
 *  - それ以外は不可
 */
export function withinBookingWindow(dateStr: string): boolean {
  const now = nowInJST();
  const today = ymd(now);

  const tmr = new Date(now);
  tmr.setDate(now.getDate() + 1);
  const tomorrow = ymd(tmr);

  const hour = now.getHours();

  if (dateStr === today) return hour < 12;
  if (dateStr === tomorrow) return hour >= 12;
  return false;
}

/** 最終可否（UI/API 共通で利用可能） */
export function canAcceptForDate(dateStr: string): boolean {
  return withinBookingWindow(dateStr) && !isClosedDate(dateStr);
}
