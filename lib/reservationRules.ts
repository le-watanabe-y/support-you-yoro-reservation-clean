// lib/reservationRules.ts
import { isJapanHoliday } from "@/lib/holidayJP";

// —— 予約上限（ご指定値）
export const LIMIT_DAILY = 6;
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;
export type Period = keyof typeof LIMIT_BY_PERIOD;

// 受付ウィンドウ：利用日 D の予約は D-1 12:00 ～ D 12:00（JST）
const HOUR = 60 * 60 * 1000;
const JST_OFFSET = 9 * HOUR;

// UTC Date -> JST "YYYY-MM-DD"
function ymdJST(d: Date): string {
  const j = new Date(d.getTime() + JST_OFFSET);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, "0");
  const day = String(j.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" 以外は空文字 */
export function normalizeDate(s: string): string {
  const t = (s ?? "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : "";
}

/** 年末年始休園（12/29–1/4, JST） */
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

/** 休園（週末 / 祝日 / 年末年始） */
export function isClosedDate(date: string | Date): boolean {
  const d = typeof date === "string" ? new Date(`${date}T00:00:00Z`) : date;
  return isWeekend(d) || isJapanHoliday(d) || isYearEnd(d);
}

/** 受付ウィンドウ（JST：D-1 12:00 ～ D 12:00）に入っているか */
export function withinOpenWindow(date: string): boolean {
  const norm = normalizeDate(date);
  if (!norm) return false;

  const d0 = new Date(`${norm}T00:00:00Z`); // D の UTC 0:00
  const openStartUtc = new Date(d0.getTime() - 21 * HOUR); // D-1 12:00 JST
  const closeAtUtc   = new Date(d0.getTime() + 3 * HOUR);  // D   12:00 JST
  const nowUtc = new Date();

  return nowUtc >= openStartUtc && nowUtc < closeAtUtc;
}
