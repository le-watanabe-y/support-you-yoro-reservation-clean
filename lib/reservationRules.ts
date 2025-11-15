// lib/reservationRules.ts ーーー 全置き換え

import Holidays from "date-holidays";

/** 午前/午後の区分 */
export type Period = "am" | "pm";

/** 予約ステータス（参照用） */
export type ReservationStatus = "pending" | "approved" | "rejected" | "canceled";

/** 上限（ヒアリング値） */
export const LIMIT_DAILY = 6 as const;
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;

/** 旧コード互換：LIMITS（daily / am / pm） */
export const LIMITS = {
  daily: LIMIT_DAILY,
  am: LIMIT_BY_PERIOD.am,
  pm: LIMIT_BY_PERIOD.pm,
} as const;

/** 定員カウント対象ステータス（旧名をそのまま提供） */
export const COUNT_STATUSES = ["pending", "approved"] as const;

/** 「先着2名は自動承認」の日次上限 */
export const AUTO_APPROVE_DAILY_LIMIT = 2 as const;

/* ───────────── 祝日 / 休園判定ユーティリティ ───────────── */

const hd = new Holidays("JP");

/** "YYYY-MM-DD" or Date -> "YYYY-MM-DD"（JST基準） */
function normalizeYmd(d: string | Date): string {
  if (typeof d === "string") return d;
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** "YYYY-MM-DD" or Date -> Date(JST 00:00) */
function toJstDate(d: string | Date): Date {
  const ymd = typeof d === "string" ? d : normalizeYmd(d);
  return new Date(`${ymd}T00:00:00+09:00`);
}

/** Zeller で曜日計算（0=Sun..6=Sat） */
function weekdayFromYmd(ymd: string): number {
  const [yy, mm, dd] = ymd.split("-").map(Number);
  let y = yy, m = mm, d = dd;
  if (m < 3) { m += 12; y -= 1; }
  const K = y % 100;
  const J = Math.floor(y / 100);
  const h = (d + Math.floor(13 * (m + 1) / 5) + K + Math.floor(K / 4) + Math.floor(J / 4) + 5 * J) % 7; // 0=Sat
  return (h + 6) % 7; // 0=Sun
}

/** 日本の祝日か */
export function isJapanHoliday(d: string | Date): boolean {
  const dt = toJstDate(d);
  return Boolean(hd.isHoliday(dt));
}

/** 年末年始（12/29〜1/4） */
function isYearEnd(d: Date): boolean {
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return (m === 12 && day >= 29) || (m === 1 && day <= 4);
}

/** 休園日か（祝日・土日・年末年始） */
export function isClosedDate(d: string | Date): boolean {
  const dt = toJstDate(d);
  const ymd = normalizeYmd(dt);
  const dow = weekdayFromYmd(ymd); // 0=Sun,6=Sat
  const weekend = dow === 0 || dow === 6;
  return weekend || isJapanHoliday(dt) || isYearEnd(dt);
}

/* ───────────── 受付ウィンドウ ───────────── */

/** 現在(JST, epoch ms) */
function nowJstMs(): number {
  // Date.now() は UTC 基準。+9h で JST 相当へ。
  return Date.now() + 9 * 60 * 60 * 1000;
}

/** 受付ウィンドウ（D-1 12:00 ～ D 12:00 JST） */
export function withinBookingWindow(dateYmd: string): boolean {
  const base = new Date(`${dateYmd}T00:00:00+09:00`).getTime();
  const start = base - 12 * 60 * 60 * 1000; // D-1 12:00
  const end   = base + 12 * 60 * 60 * 1000; // D   12:00
  const now   = nowJstMs();
  return now >= start && now < end;
}

/** 旧名互換：その日を受け付け可能か（閉園でなく、ウィンドウ内） */
export function canAcceptForDate(dateYmd: string): boolean {
  return withinBookingWindow(dateYmd) && !isClosedDate(dateYmd);
}

/* ───────────── 午前/午後 & 上限関連 ───────────── */

/** "HH:MM" -> 'am' | 'pm'（内部用） */
export function toPeriodFromTime(time: string): Period {
  const [h] = time.split(":").map(Number);
  return h < 12 ? "am" : "pm";
}

/** 旧名互換（slotFromTimeStr を使っている既存コードのため） */
export const slotFromTimeStr     = toPeriodFromTime;
export const toPeriodFromTimeStr = toPeriodFromTime;

/** 上限取得（'daily' / 'am' / 'pm' / "HH:MM" に対応） */
export function limitFor(key?: "daily" | Period | string): number {
  if (!key || key === "daily") return LIMIT_DAILY;
  if (key === "am" || key === "pm") return LIMITS[key];
  // "HH:MM" の場合
  const p = toPeriodFromTime(key);
  return LIMITS[p];
}

/** 旧名互換：YYYY-MM-DD 正規化（string/Date両対応） */
export function parseYmd(d: string | Date): string {
  return typeof d === "string" ? d : normalizeYmd(d);
}

/** 旧名互換：日次の自動承認判定（先着2名まで承認） */
export function shouldAutoApprove(currentApprovedCountOfTheDay: number): boolean {
  return currentApprovedCountOfTheDay < AUTO_APPROVE_DAILY_LIMIT;
}
