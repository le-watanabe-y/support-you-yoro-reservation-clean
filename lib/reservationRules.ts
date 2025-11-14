// lib/reservationRules.ts
import { isJpHoliday } from "@/lib/jpHolidays";

/** 回答いただいた運用値 */
export const LIMIT_DAILY = 6;
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;
export const COUNT_STATUSES = ["pending", "approved"] as const; // b: pending+approved
export const AUTO_APPROVE_FIRST = 2; // 先着2名自動承認
export const BLOCK_DUPLICATE_SAME_CHILD_SAME_DATE = true;
export const ADMIN_BYPASS = false;

/** 午前/午後の境界（JST 12:00） */
export type TimeSlot = "am" | "pm";
export const SLOT_BOUNDARY_MINUTE = 12 * 60;

/** 利用者入力の「預け希望時刻」(HH:MM) を am/pm に丸める */
export function toTimeSlotByDropoff(hhmm?: string | null): TimeSlot | null {
  if (!hhmm) return null;
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const minutes = Number(m[1]) * 60 + Number(m[2]);
  return minutes < SLOT_BOUNDARY_MINUTE ? "am" : "pm";
}

// 平日のみ開園（0=Sun ... 6=Sat）
const ALLOWED_WEEKDAYS = [1, 2, 3, 4, 5];

/** 年末年始 12/29〜1/4 は閉園 */
function isYearEndClosed(date: Date) {
  const j = toJst(date);
  const m = j.getUTCMonth() + 1;
  const d = j.getUTCDate();
  return (m === 12 && d >= 29) || (m === 1 && d <= 4);
}

export function normalizeDate(s: string) {
  return (s ?? "").slice(0, 10);
}

/** 土日・祝日・年末年始を閉園扱い */
export function isClosedDate(dateStr: string): boolean {
  const d = parseJstDate(dateStr);
  if (!d) return true;

  const dow = toJst(d).getUTCDay();
  const weekend = !ALLOWED_WEEKDAYS.includes(dow);      // 土日
  const holiday = isJpHoliday(normalizeDate(dateStr));   // 祝日（文字列で判定）
  if (weekend || holiday || isYearEndClosed(d)) return true;

  return false;
}

/** 受付ウィンドウ：D-1 12:00 〜 D 12:00（JST） */
export function withinOpenWindow(dateStr: string, now = new Date()): boolean {
  const target = parseJstDate(dateStr);
  if (!target) return false;

  const delta = diffDaysJst(now, target); // 0=当日, 1=前日
  if (delta < 0 || delta > 1) return false;

  const open = openingTimeFor(target);   // D-1 12:00
  const close = closingTimeFor(target);  // D   12:00
  return now >= open && now <= close;
}

/** 先着N名まで自動承認（N=AUTO_APPROVE_FIRST） */
export function decideInitialStatus(currentTotalCount: number): "approved" | "pending" {
  return currentTotalCount < AUTO_APPROVE_FIRST ? "approved" : "pending";
}

/* ===== JST utils ===== */
function toJst(d: Date) { return new Date(d.getTime() + 9 * 60 * 60 * 1000); }
function fromJst(y: number, m: number, d: number, h = 0, min = 0) {
  const utc = Date.UTC(y, m - 1, d, h - 9, min);
  return new Date(utc);
}
function ymd(d: Date) {
  const j = toJst(d);
  return { y: j.getUTCFullYear(), m: j.getUTCMonth() + 1, d: j.getUTCDate() };
}
function startOfDayJst(d: Date) {
  const { y, m, d: dd } = ymd(d);
  return fromJst(y, m, dd, 0, 0);
}
function diffDaysJst(a: Date, b: Date) {
  const A = startOfDayJst(a).getTime();
  const B = startOfDayJst(b).getTime();
  return Math.round((B - A) / (24 * 60 * 60 * 1000));
}
function openingTimeFor(target: Date) {
  const { y, m, d } = ymd(target);
  const prev = new Date(fromJst(y, m, d).getTime() - 24 * 60 * 60 * 1000);
  return fromJst(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), 12, 0);
}
function closingTimeFor(target: Date) {
  const { y, m, d } = ymd(target);
  return fromJst(y, m, d, 12, 0);
}
function parseJstDate(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalizeDate(s));
  if (!m) return null;
  return fromJst(+m[1], +m[2], +m[3], 0, 0);
}
