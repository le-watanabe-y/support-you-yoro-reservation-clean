// lib/reservationRules.ts
// 予約ルール一式（JST基準）

import { isJapaneseHoliday } from "./holidays";

export type Period = "am" | "pm";

// ===== 定員 =====
export const LIMIT_DAILY = 6; // 1日の総上限
export const LIMIT_BY_PERIOD: Record<Period, number> = { am: 6, pm: 6 }; // 午前/午後

// 定員に数えるステータス（b= pending + approved）
export const COUNT_STATUSES = ["pending", "approved"] as const;

// 当日/前日とも、同一日で先着 N 名は自動承認（approved）、以降は pending
export const AUTO_APPROVE_FIRST_PER_DAY = 2;

// 同一児童（氏名+生年月日）の同日重複をブロック
export const BLOCK_DUP_SAME_CHILD_SAME_DATE = true;

// 管理者バイパス（締切や休園日も通す）→ 無効のまま
export const ADMIN_BYPASS = false;

// ===== 受付ウインドウ =====
// 対象日 D の予約は「D-1 12:00 〜 D 12:00（JST）」のみ受付
export const BOOKING_WINDOW = {
  openHour: 12,  // D-1 の 12:00 から受付
  closeHour: 12, // D の 12:00 で締切（午後枠でも同じ）
} as const;

// ===== 休園 =====
export const CLOSED_WEEKDAYS = [0, 6] as const; // 0=日,6=土（＝土日）
export const CLOSED_FIXED_RANGES = [
  // 年末年始：12/29〜1/4（毎年）
  { from: { month: 12, day: 29 }, to: { month: 1, day: 4 } },
] as const;
// 日本の祝日もクローズ（ON）
export const USE_JP_HOLIDAYS = true;

// ===== ヘルパ =====
export function normalizeDate(s: string) {
  return (s ?? "").slice(0, 10); // "YYYY-MM-DD"
}
export function isPeriod(v: any): v is Period {
  return v === "am" || v === "pm";
}

// 休園日か？
export function isClosedDate(dateStr: string): boolean {
  const n = normalizeDate(dateStr);
  if (!n) return true;

  // 曜日（土日）
  const d = new Date(n + "T00:00:00.000Z"); // UTCとして生成（下でJST換算）
  const j = addHours(d, 9); // JST
  const wd = j.getUTCDay(); // 0(日)〜6(土)
  if ((CLOSED_WEEKDAYS as readonly number[]).includes(wd)) return true;

  // 年末年始（12/29〜1/4）
  const [Y, M, D] = n.split("-").map(Number);
  const cur = M * 100 + D;
  const inDec = cur >= 1229 && cur <= 1231;
  const inJan = cur >= 101 && cur <= 104;
  if (inDec || inJan) return true;

  // 祝日
  if (USE_JP_HOLIDAYS && isJapaneseHoliday(n)) return true;

  return false;
}

// 受付ウインドウ判定：D-1 12:00 〜 D 12:00（JST）
export function withinBookingWindow(targetDate: string, now: Date = new Date()): boolean {
  const n = normalizeDate(targetDate);
  if (!n) return false;
  const [Y, M, D] = n.split("-").map(Number);

  // D-1 12:00 JST と D 12:00 JST を「UTCエポック」で作る
  const open = jstDate(Y, M, D - 1, BOOKING_WINDOW.openHour, 0); // D-1 12:00 JST
  const close = jstDate(Y, M, D, BOOKING_WINDOW.closeHour, 0);   // D   12:00 JST

  return now >= open && now <= close;
}

/* ====== 時刻ユーティリティ（JSTをUTCエポックで表現） ====== */
function jstDate(y: number, m: number, d: number, h = 0, min = 0): Date {
  // Date.UTC は月・日オーバーフローを自動補正（d=0 → 前月末日）してくれる
  return new Date(Date.UTC(y, m - 1, d, h - 9, min));
}
function addHours(base: Date, hours: number) {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}
