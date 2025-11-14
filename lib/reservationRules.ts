// lib/reservationRules.ts
// 予約ルール／バリデーションの中核（JST基準）
// - 祝日クローズ対応: isJapanHoliday() を使用
// - ウィンドウ: 対象日 D の予約は D-1 12:00 ～ D 12:00 のみ受付
// - 定員: 日合計 + 午前/午後
// - 自動承認: 同一日 先着2名のみ approved、以降 pending

import { isJapanHoliday } from "@/lib/jpholiday";

/* ====== ルール定数 ====== */

// 日合計上限
export const LIMIT_DAILY = 6;

// 枠上限（午前・午後）
export const LIMIT_BY_PERIOD = { am: 6, pm: 6 } as const;

// 定員カウント対象ステータス（b = pending + approved）
export const COUNT_STATUSES = ["pending", "approved"] as const;

// 同一日で先着この人数までは自動承認（approved）
export const AUTO_APPROVE_FIRST = 2;

// 同じお子さま（氏名+生年月日）の同日申込をブロック
export const BLOCK_DUPLICATE_SAME_CHILD_SAME_DATE = true;

// 管理者バイパス（締切/休園でも登録可）— 今回は無効
export const ADMIN_BYPASS = false;

/* ====== 営業日・休園設定 ====== */

// 平日のみ受付（0=日 ... 6=土）
const ALLOWED_WEEKDAYS = [1, 2, 3, 4, 5]; // 月〜金

// 年末年始（毎年 12/29〜1/4）はクローズ
const YEAR_END = { from: { month: 12, day: 29 }, to: { month: 1, day: 4 } } as const;

/* ====== 受付ウィンドウ（JST） ======
   対象日 D の予約は D-1 12:00 ～ D 12:00 に限る
*/
export function withinOpenWindow(dateStr: string, now = new Date()): boolean {
  const target = parseJstDate(dateStr); // JST の 00:00
  if (!target) return false;

  // 予約可能なのは「当日(0)」と「翌日(1)」のみ
  const delta = diffDaysJst(now, target);
  if (delta < 0 || delta > 1) return false;

  const open = openingTimeFor(target);  // D-1 12:00 JST
  const close = closingTimeFor(target); // D   12:00 JST
  return now >= open && now <= close;
}

/* ====== 休園日判定（祝日対応を含む） ====== */
export function isClosedDate(dateStr: string): boolean {
  const d = parseJstDate(dateStr);
  if (!d) return true;

  // 土日休園
  if (!isAllowedWeekday(d)) return true;

  // 年末年始休園（12/29〜1/4）
  if (isYearEndClosed(d)) return true;

  // ★ 日本の祝日なら休園
  if (isJapanHoliday(dateStr)) return true;

  return false;
}

/* ====== 補助 ====== */

// "am" / "pm" の妥当性
export function isPeriod(v: any): v is "am" | "pm" {
  return v === "am" || v === "pm";
}

// "YYYY-MM-DD" を先頭10桁に正規化
export function normalizeDate(s: string) {
  return (s ?? "").slice(0, 10);
}

/* ====== JST ユーティリティ ====== */

function toJst(d: Date) {
  // NodeのデフォルトTZに依らず、JST(UTC+9)として扱いたいので9時間進めてUTC演算
  return new Date(d.getTime() + 9 * 60 * 60 * 1000);
}
function fromJst(y: number, m: number, d: number, h = 0, min = 0) {
  // JST指定をUTCに変換してDate化（hはJST時刻）
  const utc = Date.UTC(y, m - 1, d, h - 9, min);
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

// D-1 の 12:00 JST
function openingTimeFor(target: Date) {
  const { y, m, d } = ymd(target);
  const prev = new Date(fromJst(y, m, d).getTime() - 24 * 60 * 60 * 1000);
  return fromJst(prev.getUTCFullYear(), prev.getUTCMonth() + 1, prev.getUTCDate(), 12, 0);
}

// D の 12:00 JST
function closingTimeFor(target: Date) {
  const { y, m, d } = ymd(target);
  return fromJst(y, m, d, 12, 0);
}

function isAllowedWeekday(date: Date) {
  const j = toJst(date);
  const w = j.getUTCDay(); // 0=日 … 6=土
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

// "YYYY-MM-DD" を JST の 00:00 として Date 生成（不正なら null）
function parseJstDate(yyyy_mm_dd: string): Date | null {
  const s = normalizeDate(yyyy_mm_dd);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]), mo = Number(m[2]), d = Number(m[3]);
  return fromJst(y, mo, d, 0, 0);
}
