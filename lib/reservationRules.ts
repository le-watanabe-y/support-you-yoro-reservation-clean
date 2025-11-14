// lib/reservationRules.ts
import { isJapanHoliday } from "@/lib/jpHolidays";

export type Slot = "am" | "pm" | null;

export const RULES = {
  DAILY_LIMIT: 6,      // 1日の総上限
  SLOT_LIMIT_AM: 6,    // 午前の内部上限（集計用）
  SLOT_LIMIT_PM: 6,    // 午後の内部上限（集計用）
  COUNT_STATUSES: ["pending", "approved"] as const, // 定員に数えるステータス
  AUTO_APPROVE_FIRST_N: 2, // 先着自動承認人数
  BLOCK_DUP_SAME_CHILD_SAME_DAY: true,
  YEAR_END_CLOSED: [
    { m: 12, from: 29, to: 31 },
    { m: 1,  from: 1,  to: 4  },
  ],
} as const;

/** "YYYY-MM-DD" or Date → JSTの暦日文字列 */
function ymdOfJst(input: string | Date): string {
  if (typeof input === "string") return input;
  const j = new Date(input.getTime() + 9 * 60 * 60 * 1000);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, "0");
  const d = String(j.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 受付ウィンドウ: D-1 12:00 ～ D 12:00（JST） */
export function withinBookingWindow(ymd: string, now: Date = new Date()): boolean {
  const end = new Date(`${ymd}T12:00:00+09:00`);
  const begin = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return begin <= now && now <= end;
}

/** 土日判定 */
export function isWeekend(input: string | Date): boolean {
  const [Y, M, D] = ymdOfJst(input).split("-").map(Number);
  const dow = new Date(Y, M - 1, D).getDay(); // 0:日..6:土
  return dow === 0 || dow === 6;
}

/** 年末年始の固定休園 */
export function isYearEndClosed(input: string | Date): boolean {
  const [, mStr, dStr] = ymdOfJst(input).split("-");
  const m = Number(mStr), d = Number(dStr);
  return RULES.YEAR_END_CLOSED.some(r => r.m === m && d >= r.from && d <= r.to);
}

/** 休園日（＝土日 or 祝日 or 年末年始） */
export function isClosedDate(input: string | Date): boolean {
  return isWeekend(input) || isJapanHoliday(input) || isYearEndClosed(input);
}

/** HH:MM → 内部スロット（am/pm）※UIは任意の時刻、内部集計はam/pm */
export function deriveSlotFromTime(hhmm: string | null | undefined): Slot {
  if (!hhmm) return null;
  const h = Number(hhmm.split(":")[0]);
  if (Number.isNaN(h)) return null;
  return h < 12 ? "am" : "pm";
}

export function slotLimit(slot: Slot): number | null {
  if (slot === "am") return RULES.SLOT_LIMIT_AM;
  if (slot === "pm") return RULES.SLOT_LIMIT_PM;
  return null;
}

export function pickAutoStatus(approvedCountForDay: number): "approved" | "pending" {
  return approvedCountForDay < RULES.AUTO_APPROVE_FIRST_N ? "approved" : "pending";
}
