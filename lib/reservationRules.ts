// lib/reservationRules.ts
// 祝日判定の実装ファイル名に合わせて import 名を合わせてください
import { isJapanHoliday } from "@/lib/jpHolidays";

/** 定員カウント対象ステータス */
export const COUNT_STATUSES = ["pending", "approved"] as const;

/** 上限（設定） */
export const LIMIT_DAILY = 6 as const; // 1日の総上限
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const; // 午前/午後の上限

/** 互換用エクスポート（旧コードが参照することがある） */
export const LIMITS = {
  daily: LIMIT_DAILY,
  am: LIMIT_BY_PERIOD.am,
  pm: LIMIT_BY_PERIOD.pm,
} as const;

export type Period = keyof typeof LIMIT_BY_PERIOD; // 'am' | 'pm'

function nowInJST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}

/** YYYY-MM-DD（JST） */
export function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → JSTの00:00 */
export function parseYmd(s: string): Date {
  return new Date(`${s}T00:00:00+09:00`);
}

/** 'HH:mm' → 'am' | 'pm' */
export function slotFromTimeStr(time?: string | null): Period {
  if (!time) return "am";
  const [h] = time.split(":").map(Number);
  return Number.isFinite(h) && h >= 12 ? "pm" : "am";
}

/** 新名称（旧slotFromTimeStr互換） */
export function toPeriodFromTime(time?: string | null): Period {
  return slotFromTimeStr(time);
}

/** 休園判定：土日祝・年末年始（12/29〜1/4） */
export function isClosedDate(dateStr: string): boolean {
  const dow = new Date(`${dateStr}T09:00:00+09:00`).getUTCDay(); // 0=日,6=土
  const weekend = dow === 0 || dow === 6;

  const [, mStr, dStr] = dateStr.split("-");
  const m = Number(mStr), d = Number(dStr);
  const yearend = (m === 12 && d >= 29) || (m === 1 && d <= 4);

  const holiday = (() => {
    try { return !!isJapanHoliday?.(dateStr); } catch { return false; }
  })();

  return weekend || holiday || yearend;
}

/** 受付ウィンドウ：
 *  - 00:00〜11:59 JST → 当日のみ受付
 *  - 12:00〜23:59 JST → 翌日のみ受付
 */
export function withinBookingWindow(dateStr: string): boolean {
  const now = nowInJST();
  const today = ymd(now);

  const t = new Date(now);
  t.setDate(now.getDate() + 1);
  const tomorrow = ymd(t);

  const hour = now.getHours();
  if (dateStr === today) return hour < 12;
  if (dateStr === tomorrow) return hour >= 12;
  return false;
}

/** 受付最終可否（休園日でなく、かつ受付ウィンドウ内） */
export function canAcceptForDate(dateStr: string): boolean {
  return withinBookingWindow(dateStr) && !isClosedDate(dateStr);
}

/** 上限を返す：period 指定で AM/PM、未指定で日上限 */
export function limitFor(period?: Period): number {
  return period ? LIMIT_BY_PERIOD[period] : LIMIT_DAILY;
}

/** 自動承認：1日先着2名まで approved */
export const AUTO_APPROVE_HEADCOUNT = 2 as const;
export function shouldAutoApprove(currentApprovedCountOfDay: number): boolean {
  return currentApprovedCountOfDay < AUTO_APPROVE_HEADCOUNT;
}
