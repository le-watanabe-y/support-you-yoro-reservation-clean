// lib/reservationRules.ts
export const LIMIT_DAILY = 6; // 1日の総上限
export const LIMIT_BY_PERIOD = { am: 3, pm: 3 } as const; // 午前/午後の上限
export const COUNT_STATUSES = ["pending", "approved"] as const; // 定員に数えるステータス

// 受付可能期間（今日〜30日先）
export const OPEN_DAYS_AHEAD = 30;

// 休園日（必要があれば追加。例: "2025-12-29"）
export const CLOSED_DATES: string[] = [];

// 曜日で閉園（0=Sun, 6=Sat）。必要に応じて追加
export const CLOSED_WEEKDAYS: number[] = []; // 例: [0] なら日曜休み

export function normalizeDate(s: string) {
  // 受け取った "YYYY-MM-DD" をそのまま返す前提
  return (s ?? "").slice(0, 10);
}

export function isClosedDate(dateStr: string) {
  const n = normalizeDate(dateStr);
  if (!n) return true;
  if (CLOSED_DATES.includes(n)) return true;
  const d = new Date(n + "T00:00:00");
  const wd = d.getDay();
  return CLOSED_WEEKDAYS.includes(wd);
}

export function withinOpenWindow(dateStr: string) {
  const n = normalizeDate(dateStr);
  if (!n) return false;
  const target = new Date(n + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date();
  last.setHours(0, 0, 0, 0);
  last.setDate(last.getDate() + OPEN_DAYS_AHEAD);
  return target >= today && target <= last;
}

export function isPeriod(v: any): v is "am" | "pm" {
  return v === "am" || v === "pm";
}
