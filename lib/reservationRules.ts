// lib/reservationRules.ts
import { isJapanHoliday } from "@/lib/jpholiday";

/** 施設の運用ルール（今回の回答値に合わせてあります） */
export const RULES = {
  capacityPerDay: 6,                // 1日の総上限
  capacityAM: 6,                    // 午前上限
  capacityPM: 6,                    // 午後上限
  countPolicy: ["pending", "approved"] as const, // 定員に数えるステータス（b）
  autoApproveFirstN: 2,             // 先着2名を自動承認
  windowStartHourJST: 12,           // 受付ウィンドウ開始：前日 12:00
  windowEndHourJST: 12,             // 受付ウィンドウ終了：当日 12:00
  yearEndClose: {                   // 年末年始休園
    start: { month: 12, day: 29 },
    end:   { month: 1,  day: 4  },
  },
} as const;

/** "YYYY-MM-DD" を分解 */
function ymd(dateStr: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr ?? "");
  if (!m) throw new Error("Invalid date (YYYY-MM-DD expected)");
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** JSTの「YYYY-MM-DD HH:MM」をUTC Dateで生成（JST=UTC+9） */
function jstDate(dateStr: string, hour = 0, min = 0): Date {
  const [y, mo, d] = ymd(dateStr);
  // 「JST の y-mo-d hour:min」を UTC に変換して表現
  return new Date(Date.UTC(y, mo - 1, d, hour - 9, min, 0, 0));
}

/** 日付に days 加減（結果は "YYYY-MM-DD"） */
function addDays(dateStr: string, days: number): string {
  const [y, mo, d] = ymd(dateStr);
  const dt = new Date(Date.UTC(y, mo - 1, d, 0, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = `${dt.getUTCMonth() + 1}`.padStart(2, "0");
  const dd = `${dt.getUTCDate()}`.padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** 土日判定（JST基準） */
export function isWeekend(dateStr: string): boolean {
  const [y, mo, d] = ymd(dateStr);
  // JSTの 00:00 を UTC に直して曜日を判定
  const dt = new Date(Date.UTC(y, mo - 1, d, -9, 0, 0, 0));
  const dow = dt.getUTCDay(); // 0:Sun … 6:Sat
  return dow === 0 || dow === 6;
}

/** 年末年始休園（12/29～1/4） */
export function isYearEndClosed(dateStr: string): boolean {
  const [, mo, d] = ymd(dateStr);
  if (mo === 12 && d >= RULES.yearEndClose.start.day) return true;
  if (mo === 1  && d <= RULES.yearEndClose.end.day)   return true;
  return false;
}

/** 休園日（祝日/土日/年末年始） */
export function isClosedDate(dateStr: string): boolean {
  // ★ ここが今回の修正ポイント：isJapanHoliday は string を受け取る
  return isWeekend(dateStr) || isJapanHoliday(dateStr) || isYearEndClosed(dateStr);
}

/** 受付ウィンドウ：前日12:00～当日12:00（JST） */
export function withinBookingWindow(targetDate: string, now: Date = new Date()): boolean {
  const startDate = addDays(targetDate, -1);
  const start = jstDate(startDate, RULES.windowStartHourJST, 0); // 前日12:00(JST)
  const end   = jstDate(targetDate, RULES.windowEndHourJST, 0);  // 当日12:00(JST)
  return now >= start && now < end;
}

/** am/pm 正規化（外部から来た表記ゆれに対応） */
export function normalizeSlot(slot?: string | null): "am" | "pm" | undefined {
  if (!slot) return undefined;
  const v = String(slot).toLowerCase();
  if (v === "am" || v === "午前") return "am";
  if (v === "pm" || v === "午後") return "pm";
  return undefined;
}

/** "HH:MM" → am/pm 自動判定（12:00 以降は pm） */
export function slotFromHHmm(hhmm?: string | null): "am" | "pm" | undefined {
  if (!hhmm) return undefined;
  const m = /^(\d{2}):(\d{2})/.exec(hhmm);
  if (!m) return undefined;
  const hour = Number(m[1]);
  return hour < 12 ? "am" : "pm";
}
