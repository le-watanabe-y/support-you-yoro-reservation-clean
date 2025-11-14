// /lib/reservationRules.ts
import { isJapanHoliday } from "@/lib/jpholiday";

/** ── ご指定の上限 ───────────────────────── */
export const LIMIT_DAILY = 6 as const;                           // 1日の総上限
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;        // 内部用（管理側参照）

/** 正確のため、過去の API との互換 */
export const LIMITS = {
  daily: LIMIT_DAILY,
  am: LIMIT_BY_PERIOD.am,
  pm: LIMIT_BY_PERIOD.pm,
} as const;

/** 定員に数えるステータス（pending + approved） */
export const COUNT_STATUSES = ["pending", "approved"] as const;

export type Period = keyof typeof LIMIT_BY_PERIOD; // "am" | "pm"

const HOUR = 60 * 60 * 1000;
const JST_OFFSET = 9 * HOUR;

/** JSTの年月日文字列（YYYY-MM-DD） */
export function ymdJST(d: Date): string {
  const j = new Date(d.getTime() + JST_OFFSET);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, "0");
  const day = String(j.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" を UTC Date に（00:00 JST を基準に扱いたい場合は用途側で調整） */
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** 年末年始の休園（12/29〜1/4） */
function isYearEndClosed(date: Date): boolean {
  const j = new Date(date.getTime() + JST_OFFSET);
  const m = j.getUTCMonth() + 1;
  const d = j.getUTCDate();
  return (m === 12 && d >= 29) || (m === 1 && d <= 4);
}

/** 土日 or 祝日 or 年末年始 なら閉園 */
export function isClosedDate(date: Date): boolean {
  const j = new Date(date.getTime() + JST_OFFSET);
  const dow = j.getUTCDay(); // 0 Sun, 6 Sat
  const weekend = dow === 0 || dow === 6;
  const holiday = isJapanHoliday(date);
  return weekend || holiday || isYearEndClosed(date);
}

/** 受付ウィンドウ（D-1 12:00 JST 〜 D 12:00 JST） */
function windowFor(date: Date) {
  const j = new Date(date.getTime() + JST_OFFSET);
  const y = j.getUTCFullYear();
  const m = j.getUTCMonth();
  const d = j.getUTCDate();
  const open = Date.UTC(y, m, d - 1, 12) - JST_OFFSET;  // D-1 12:00 JST をUTCミリ秒に
  const close = Date.UTC(y, m, d, 12) - JST_OFFSET;     // D   12:00 JST をUTCミリ秒に
  return { open, close };
}

/** その日付を今から予約できるか（時間条件のみ） */
export function withinBookingWindow(date: Date, now: Date = new Date()): boolean {
  const { open, close } = windowFor(date);
  const t = now.getTime();
  return t >= open && t < close;
}

/** 当該日付が「受付可」か（休園日も考慮） */
export function canAcceptForDate(date: Date, now: Date = new Date()): boolean {
  return withinBookingWindow(date, now) && !isClosedDate(date);
}

/** その日の総上限（現状は日単位で一律） */
export function limitFor(_date: Date): number {
  return LIMIT_DAILY;
}

/** 先着2名は自動承認、以降は pending */
export function shouldAutoApprove(approvedCountForDate: number): boolean {
  return approvedCountForDate < 2;
}

/** 利用者入力の「希望時刻」から AM/PM に丸め（内部集計用） */
export type TimeSlot = "am" | "pm";
export function slotFromTimeStr(time: string | null | undefined): TimeSlot {
  // 文字比較でOK（"HH:mm" 前提）
  return time && time >= "12:00" ? "pm" : "am";
}
