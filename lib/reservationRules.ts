// lib/reservationRules.ts
export type Status = "pending" | "approved" | "rejected" | "canceled";
export type Period = "am" | "pm";

export const LIMIT_DAILY = 6 as const;
export const LIMIT_BY_PERIOD: Record<Period, number> = { am: 6, pm: 6 };
export const COUNT_STATUSES: Status[] = ["pending", "approved"];

function toDateJST(dateStr: string) {
  // YYYY-MM-DD を JST で midnight に
  return new Date(`${dateStr}T00:00:00+09:00`);
}
function nowJST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function toPeriodFromTime(hhmm: string): Period {
  const h = parseInt(hhmm.split(":")[0] || "0", 10);
  return h < 12 ? "am" : "pm";
}

function isWeekend(dateStr: string) {
  const w = toDateJST(dateStr).getDay(); // 0=Sun,6=Sat
  return w === 0 || w === 6;
}
function isYearEndBreak(dateStr: string) {
  const d = toDateJST(dateStr);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return (m === 12 && day >= 29) || (m === 1 && day <= 4);
}

// 2025年の主な祝日（簡易・固定）※運用で翌年は更新してください
const HOLIDAYS_2025 = new Set([
  "2025-01-01","2025-01-13","2025-02-11","2025-02-23","2025-02-24",
  "2025-03-20","2025-04-29","2025-05-03","2025-05-04","2025-05-05","2025-05-06",
  "2025-07-21","2025-08-11","2025-09-15","2025-09-23","2025-10-13","2025-11-03",
  "2025-11-23","2025-11-24",
]);
function isJapaneseHoliday(dateStr: string) {
  return HOLIDAYS_2025.has(dateStr);
}

export function isClosedDate(dateStr: string) {
  return isWeekend(dateStr) || isJapaneseHoliday(dateStr) || isYearEndBreak(dateStr);
}

export function withinBookingWindow(targetDate: string) {
  const now = nowJST();
  const today = ymd(now);
  const tomorrow = ymd(addDays(now, 1));
  if (now.getHours() < 12) return targetDate === today;     // 0:00-11:59 → 当日のみ
  return targetDate === tomorrow;                            // 12:00-24:00 → 翌日のみ
}

export function currentPreferredDate() {
  const now = nowJST();
  return ymd(now.getHours() < 12 ? now : addDays(now, 1));
}
