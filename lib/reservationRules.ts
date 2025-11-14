// lib/reservationRules.ts
// 予約ルール（JST）。API バリデーションで参照します。

// 定員：1日合計 6、午前 6、午後 6（full は使わない前提）
export const LIMIT_DAILY = 6;
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;

// 定員に数えるステータス（ご指定 b = pending + approved）
export const COUNT_STATUSES = ["pending", "approved"] as const;

// 自動承認：当日/前日の予約とも、同一日で「先着 2 件」だけ approved、以降は pending
export const AUTO_APPROVE_FIRST = 2;

// 同じお子さまの同日重複はブロック
export const BLOCK_DUPLICATE_SAME_CHILD_SAME_DATE = true;

// 管理者バイパス（締切超えや休園日でも管理用に通す）※未回答なのでデフォルト false
export const ADMIN_BYPASS = false;

// 平日のみ受付（0=日 ... 6=土） → 土日休園
const ALLOWED_WEEKDAYS = [1, 2, 3, 4, 5];

// 年末年始クローズ（毎年 12/29〜1/4）
const YEAR_END = { from: { month: 12, day: 29 }, to: { month: 1, day: 4 } } as const;

// 受付ウィンドウ：対象日 D の予約は D-1 12:00 〜 D 12:00（JST）。対象日は当日(0)と翌日(1)のみ。
export function withinOpenWindow(dateStr: string, now = new Date()): boolean {
  const target = parseJstDate(dateStr); // JST の 00:00
  if (!target) return false;

  const delta = diffDaysJst(now, target);
  if (delta < 0 || delta > 1) return false; // 当日(0)と翌日(1)のみ

  const open = openingTimeFor(target);  // D-1 12:00
  const close = closingTimeFor(target); // D   12:00
  return now >= open && now <= close;
}

// 休園判定：土日＋年末年始（祝日は後段で対応可能）
export function isClosedDate(dateStr: string): boolean {
  const d = parseJstDate(dateStr);
  if (!d) return true;
  if (!isAllowedWeekday(d)) return true;
  if (isYearEndClosed(d)) return true;
  return false;
}

// am / pm の妥当性
export function isPeriod(v: any): v is "am" | "pm" {
  return v === "am" || v === "pm";
}

// "YYYY-MM-DD" をそのまま正規化（先頭 10 桁）
export function normalizeDate(s: string) {
  return (s ?? "").slice(0, 10);
}

/* ======== JST 日付ユーティリティ ======== */

function toJst(d: Date) {
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}
function fromJst(y: number, m: number, d: number, h = 0, min = 0) {
  const utc = Date.UTC(y, m - 1, d, h - 9, min); // JST→UTC に直して Date
  return new Date(utc);
}
function ymd(d: Date) {
  const j = toJst(d);
  return { y: j.getUTCFullYear(), m: j.getUTCMonth() + 1, d: j.getUTCDate() };
}
function startOfDayJst(d: Date) {
  const { y, m, d: dd } = ymd(d);
  return fromJst(y, m, dd, 0, 0);
}
function diffDaysJst(a: Date, b: Date) {
  const A = startOfDayJst(a).getTime();
  const B = startOfDayJst(b).getTime();
  return Math.round((B - A) / (24 * 60 * 60 * 1000));
}

function openingTimeFor(target: Date) {
  // D-1 の 12:00
  const { y, m, d } = ymd(target);
  const prev = new Date(fromJst(y, m, d).getTime() - 24 * 60 * 60 * 1000);
  return fromJst(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), 12, 0);
}
function closingTimeFor(target: Date) {
  // D の 12:00
  const { y, m, d } = ymd(target);
  return fromJst(y, m, d, 12, 0);
}

function isAllowedWeekday(date: Date) {
  const j = toJst(date);
  const w = j.getUTCDay(); // 0=日 ... 6=土
  return ALLOWED_WEEKDAYS.includes(w);
}
function isYearEndClosed(date: Date) {
  const j = toJst(date);
  const m = j.getUTCMonth() + 1;
  const d = j.getUTCDate();
  const inDec = m === 12 && d >= YEAR_END.from.day;
  const inJan = m === 1 && d <= YEAR_END.to.day;
  return inDec || inJan;
}

function parseJstDate(yyyy_mm_dd: string): Date | null {
  const s = normalizeDate(yyyy_mm_dd);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return fromJst(y, mo, d, 0, 0);
}
