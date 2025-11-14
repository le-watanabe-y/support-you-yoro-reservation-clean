// lib/reservationRules.ts
// 祝日/土日/年末年始・受付ウィンドウ・定員・AM/PM 自動分類

import { isJapaneseHoliday } from "@/lib/jpholiday";

export type TimeSlot = "am" | "pm";

export const LIMITS = {
  day: 6,
  am: 6,
  pm: 6,
  autoApproveFirst: 2, // 先着2件は自動承認
  countStatuses: ["pending", "approved"] as const, // 在庫に数えるステータス
} as const;

/** "YYYY-MM-DD" -> UTC midnight の Date に変換 */
export function parseYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]) - 1, d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0));
}

/** "HH:mm" -> AM/PM を自動判定（12:00 以降は pm）*/
export function slotFromTimeStr(hhmm?: string | null): TimeSlot {
  if (!hhmm) return "am";
  const [h] = hhmm.split(":").map(Number);
  if (Number.isNaN(h)) return "am";
  return h >= 12 ? "pm" : "am";
}

/** 年末年始（12/29〜1/4） */
function isYearEnd(dateUtc: Date): boolean {
  const m = dateUtc.getUTCMonth() + 1;
  const d = dateUtc.getUTCDate();
  return (m === 12 && d >= 29) || (m === 1 && d <= 4);
}

/** 土日 or 祝日 or 年末年始 */
export function isClosedDate(dateUtc: Date): boolean {
  const dow = dateUtc.getUTCDay(); // 0=Sun,6=Sat
  const weekend = dow === 0 || dow === 6;
  const holiday = isJapaneseHoliday(dateUtc);
  return weekend || holiday || isYearEnd(dateUtc);
}

/** 受付ウィンドウ D-1 12:00(JST) 〜 D 12:00(JST) を UTC で返す */
export function bookingWindowUtcFor(dateUtc: Date): { start: Date; end: Date } {
  // D 12:00 JST = D 03:00 UTC
  const y = dateUtc.getUTCFullYear();
  const m = dateUtc.getUTCMonth();
  const d = dateUtc.getUTCDate();
  const endUtc = new Date(Date.UTC(y, m, d, 3, 0, 0));
  const startUtc = new Date(endUtc.getTime() - 24 * 60 * 60 * 1000);
  return { start: startUtc, end: endUtc };
}

export function withinBookingWindow(dateUtc: Date, nowUtc = new Date()): boolean {
  const { start, end } = bookingWindowUtcFor(dateUtc);
  return nowUtc >= start && nowUtc < end;
}

export function limitFor(slot: TimeSlot): number {
  return slot === "am" ? LIMITS.am : LIMITS.pm;
}

export type WindowCheck =
  | { ok: true }
  | { ok: false; reason: "closed" | "outside_window" };

export function canAcceptForDate(dateUtc: Date, nowUtc = new Date()): WindowCheck {
  if (isClosedDate(dateUtc)) return { ok: false, reason: "closed" };
  if (!withinBookingWindow(dateUtc, nowUtc)) return { ok: false, reason: "outside_window" };
  return { ok: true };
}

export function shouldAutoApprove(approvedCountForDay: number): boolean {
  return approvedCountForDay < LIMITS.autoApproveFirst;
}
