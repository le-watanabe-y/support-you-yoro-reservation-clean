// lib/reservationRules.ts
import { isJapanHoliday } from "@/lib/holidayJP";

/** —— ご指定の上限 —— */
export const LIMIT_DAILY = 6;
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;

/** 互換のため、過去の import を吸収 */
export const LIMITS = {
  daily: LIMIT_DAILY,
  am: LIMIT_BY_PERIOD.am,
  pm: LIMIT_BY_PERIOD.pm,
};

/** 定員に数えるステータス（pending + approved） */
export const COUNT_STATUSES = ["pending", "approved"] as const;

export type Period = keyof typeof LIMIT_BY_PERIOD;

const HOUR = 60 * 60 * 1000;
const JST_OFFSET = 9 * HOUR;

function ymdJST(d: Date): string {
  const j = new Date(d.getTime() + JST_OFFSET);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, "0");
  const day = String(j.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" を妥当化（不正なら空文字） */
export function normalizeDate(s: string): string {
  const t = (s ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

/** 年末年始休園（12/29〜1/4, JST） */
export function isYearEnd(dateUtc: Date): boolean {
  const [_, mm, dd] = ymdJST(dateUtc).split("-").map(Number);
  return (mm === 12 && dd >= 29) || (mm === 1 && dd <= 4);
}

/** 土日（JST） */
export function isWeekend(dateUtc: Date): boolean {
  const j = new Date(dateUtc.getTime() + JST_OFFSET);
  const dow = j.getUTCDay(); // 0:日, 6:土
  return dow === 0 || dow === 6;
}

/** 休園（週末／祝日／年末年始） */
export function isClosedDate(date: string | Date): boolean {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  return isWeekend(d) || isJapanHoliday(d) || isYearEnd(d);
}

/** 受付ウィンドウ（JST：D-1 12:00 〜 D 12:00）内か？ */
export function withinOpenWindow(date: string): boolean {
  const norm = normalizeDate(date);
  if (!norm) return false;

  const d0 = new Date(`${norm}T00:00:00Z`); // D の UTC 0:00
  const openStartUtc = new Date(d0.getTime() - 21 * HOUR); // D-1 12:00 JST
  const closeAtUtc   = new Date(d0.getTime() + 3 * HOUR);  // D   12:00 JST
  const nowUtc = new Date();

  return nowUtc >= openStartUtc && nowUtc < closeAtUtc;
}

/** 利用者の「預け希望時刻」から AM/PM を推定 */
export function periodFromTime(time?: string | null): Period {
  if (!time) return "am";
  const h = Number(time.split(":")[0] ?? "9");
  return h < 12 ? "am" : "pm";
}
