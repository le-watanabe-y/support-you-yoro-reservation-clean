// lib/reservationRules.ts
import { isJapaneseHoliday } from "@/lib/jpholiday";

/** ── ご指定の上限 ───────────────────────── */
export const LIMIT_DAILY = 6;
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;

/** 既存コード互換のまとめ */
export const LIMITS = {
  daily: LIMIT_DAILY,
  am: LIMIT_BY_PERIOD.am,
  pm: LIMIT_BY_PERIOD.pm,
};

/** 定員に数えるステータス（pending + approved） */
export const COUNT_STATUSES = ["pending", "approved"] as const;

const HOUR = 60 * 60 * 1000;

/** "YYYY-MM-DD" を JST 時刻で Date 化（内部は UTC） */
function jstDate(ymd: string, h = 0, m = 0): Date {
  const [y, mm, dd] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (mm || 1) - 1, dd || 1, h - 9, m, 0));
}

/** Date | string を "YYYY-MM-DD" に正規化 */
export function parseYmd(input: string | Date): string {
  if (input instanceof Date) {
    const y = input.getUTCFullYear();
    const m = String(input.getUTCMonth() + 1).padStart(2, "0");
    const d = String(input.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return String(input).slice(0, 10);
}

/** 休園日か？（土日 / 祝日 / 12/29〜1/4） */
export function isClosedDate(dateStr: string): boolean {
  const d = jstDate(dateStr, 0, 0);
  const dow = d.getUTCDay(); // 0:Sun ... 6:Sat（JST 基準）
  const weekend = dow === 0 || dow === 6;

  const [, m, day] = dateStr.split("-").map(Number);
  const yearEndNewYear = (m === 12 && day >= 29) || (m === 1 && day <= 4);

  const holiday = isJapaneseHoliday(dateStr);
  return weekend || holiday || yearEndNewYear;
}

/** 予約受付ウィンドウ：D-1 12:00 JST 〜 D 12:00 JST */
export function withinBookingWindow(dateStr: string, now = new Date()): boolean {
  const start = jstDate(dateStr, 12, 0); // D 12:00
  start.setUTCDate(start.getUTCDate() - 1); // → D-1 12:00
  const end = jstDate(dateStr, 12, 0); // D 12:00
  return now >= start && now < end;
}

/** その日を受け付けて良いか（ウィンドウ内 かつ 開園日） */
export function canAcceptForDate(dateStr: string, now = new Date()): boolean {
  return withinBookingWindow(dateStr, now) && !isClosedDate(dateStr);
}

/** 利用者の「預け希望時刻」→ AM/PM 判定（12:00 未満 = AM） */
export type Period = "am" | "pm";
export function periodFromTime(time?: string | null): Period {
  if (!time) return "am";
  const [hh] = String(time).split(":").map(Number);
  return Number(hh) >= 12 ? "pm" : "am";
}

/** 指定日の上限値（総量 + 枠別） */
export function limitFor(
  dateStr: string,
  time?: string | null
): { daily: number; period: number; periodKey: Period } {
  const key = periodFromTime(time);
  return { daily: LIMIT_DAILY, period: LIMIT_BY_PERIOD[key], periodKey: key };
}

/**
 * 自動承認か？（当日/前日の“先着2名”を自動承認）
 * 既存コードの呼び出しに合わせるため any 受けにして安全側で解釈。
 */
export function shouldAutoApprove(
  currentApprovedOrCount: number,
  maybePending?: number
): boolean {
  const counted =
    typeof maybePending === "number"
      ? currentApprovedOrCount + maybePending
      : currentApprovedOrCount;
  return counted < 2;
}

/** Date → JST の "YYYY-MM-DD" 文字列（参考/互換） */
export function ymdJST(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
