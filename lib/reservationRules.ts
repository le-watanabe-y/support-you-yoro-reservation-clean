// lib/reservationRules.ts
import { isJapanHoliday } from '@/lib/jpHolidays';

export type TimeSlot = 'am' | 'pm';

// ご指定の上限・自動承認
export const LIMITS = {
  daily: 6,
  am: 6,
  pm: 6,
  autoApproveFirst: 2, // 先着2名は自動承認（残り4名はpending）
};

// 定員カウント対象（b: pending + approved）
export const COUNT_STATUSES = ['pending', 'approved'] as const;

// "YYYY-MM-DD" → 当日0時(UTC)
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// JST 土日
function isWeekendJst(dateUtc: Date): boolean {
  const jst = new Date(dateUtc.getTime() + 9 * 60 * 60 * 1000);
  const dow = jst.getUTCDay(); // 0=Sun ... 6=Sat
  return dow === 0 || dow === 6;
}

// 年末年始（12/29〜1/4）JST
function isYearEndJst(dateUtc: Date): boolean {
  const jst = new Date(dateUtc.getTime() + 9 * 60 * 60 * 1000);
  const m = jst.getUTCMonth(); // 0-based
  const d = jst.getUTCDate();
  return (m === 11 && d >= 29) || (m === 0 && d <= 4);
}

// 休園日（週末・祝日・年末年始）
export function isClosedDate(dateUtc: Date): boolean {
  return isWeekendJst(dateUtc) || isYearEndJst(dateUtc) || isJapanHoliday(dateUtc);
}

// 受付ウィンドウ：D-1 12:00(JST)〜D 12:00(JST) = UTC換算で D-1 03:00〜D 03:00
export function withinBookingWindow(dateUtc: Date, nowUtc: Date = new Date()): boolean {
  const y = dateUtc.getUTCFullYear();
  const m = dateUtc.getUTCMonth();
  const d = dateUtc.getUTCDate();
  const openUtc  = new Date(Date.UTC(y, m, d - 1, 3, 0, 0));
  const closeUtc = new Date(Date.UTC(y, m, d,     3, 0, 0));
  return nowUtc >= openUtc && nowUtc <= closeUtc;
}

// 総合判定
export function canAcceptForDate(dateUtc: Date, nowUtc: Date = new Date()) {
  const closed = isClosedDate(dateUtc);
  const within = withinBookingWindow(dateUtc, nowUtc);
  return { closed, withinBookingWindow: within, canReserve: within && !closed };
}

// 枠（管理画面将来用）
export function limitFor(slot?: TimeSlot | null): number {
  if (slot === 'am') return LIMITS.am;
  if (slot === 'pm') return LIMITS.pm;
  return LIMITS.daily;
}
