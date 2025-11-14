// lib/reservationRules.ts
// 予約ルール（定員・受付ウィンドウ・休園日等）— JST 判定で統一
import { isJapanHoliday } from "@/lib/jpholiday";

/* === 運用設定（ヒアリング反映） ============================== */
export const LIMIT_DAILY = 6 as const;                           // 1日の総上限
export type TimeSlot = "am" | "pm";
export const LIMIT_BY_PERIOD: Record<TimeSlot, number> = {       // am/pm 上限
  am: 6,
  pm: 6,
};
export const COUNT_STATUSES = ["pending", "approved"] as const;   // b：pending+approved をカウント
export const AUTO_APPROVE_FIRST_PER_DAY = 2 as const;             // 先着2名は自動承認
export const BLOCK_DUP_SAME_CHILD_SAME_DATE = true as const;      // 同日重複ブロック
export const ADMIN_BYPASS = false as const;                       // 管理者バイパス無効

// 旧コード互換（LIMITS を参照している箇所のため）
export const LIMITS = {
  daily: LIMIT_DAILY,
  am: LIMIT_BY_PERIOD.am,
  pm: LIMIT_BY_PERIOD.pm,
} as const;
/* ============================================================= */

/** "YYYY-MM-DD" 正規化（不正なら空文字） */
export function normalizeDate(input: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((input ?? "").trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

/** JST 正午の Date を得る */
function jstMidday(ymd: string): Date {
  return new Date(`${ymd}T12:00:00+09:00`);
}

/** JST 任意時刻の Date を得る */
function jstAt(ymd: string, hh = 0, mm = 0): Date {
  const H = String(hh).padStart(2, "0");
  const M = String(mm).padStart(2, "0");
  return new Date(`${ymd}T${H}:${M}:00+09:00`);
}

/** Date → JST YYYY-MM-DD */
function toJstYmd(d: Date): string {
  const ms = d.getTime() + 9 * 60 * 60 * 1000;
  const dj = new Date(ms);
  const y = dj.getUTCFullYear();
  const m = String(dj.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dj.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 年末年始（12/29〜1/4）休園 */
function isYearEnd(d: Date): boolean {
  const [, mm, dd] = toJstYmd(d).split("-").map(Number);
  return (mm === 12 && dd >= 29) || (mm === 1 && dd <= 4);
}

/** 休園日（週末・祝日・年末年始） */
export function isClosedDate(date: string | Date): boolean {
  const ymd = typeof date === "string" ? normalizeDate(date) : toJstYmd(date);
  if (!ymd) return true;
  const mid = jstMidday(ymd);
  const dow = mid.getUTCDay();              // Sun=0..Sat=6（JST 正午基準）
  const weekend = dow === 0 || dow === 6;
  return weekend || isJapanHoliday(mid) || isYearEnd(mid);
}

/** 受付ウィンドウ：D-1 12:00 〜 D 12:00（JST） */
export function withinBookingWindow(dateStr: string): boolean {
  const d = normalizeDate(dateStr);
  if (!d) return false;

  const start = (() => {
    const mid = jstMidday(d);
    mid.setUTCDate(mid.getUTCDate() - 1);
    const startYmd = toJstYmd(mid);
    return jstAt(startYmd, 12, 0).getTime();
  })();
  const end = jstAt(d, 12, 0).getTime(); // 終了は排他的

  const now = Date.now();
  return now >= start && now < end;
}

/** 利用者入力「HH:mm」→ 管理用の am / pm を推定 */
export function toPeriodFromTime(t: string): TimeSlot {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec((t ?? "").trim());
  if (!m) return "am";
  const h = Number(m[1]);
  return h < 12 ? "am" : "pm";
}

/* === 既存コード互換の名称でエクスポート ======================= */
export const parseYmd = normalizeDate;                        // 既存 import 互換
export function canAcceptForDate(dateStr: string): boolean {  // 既存 import 互換
  return !isClosedDate(dateStr) && withinBookingWindow(dateStr);
}
export function limitFor(period?: TimeSlot | null): number {  // 既存 import 互換
  return period ? LIMIT_BY_PERIOD[period] : LIMIT_DAILY;
}
/** その日の「既に承認済みの人数」を受け取り、先着2名なら true */
export function shouldAutoApprove(approvedCountForDay: number): boolean {
  return approvedCountForDay < AUTO_APPROVE_FIRST_PER_DAY;
}
/** 旧名互換：slotFromTimeStr → toPeriodFromTime */
export function slotFromTimeStr(time: string): TimeSlot {
  return toPeriodFromTime(time);
}
/* ============================================================= */
