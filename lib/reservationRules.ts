// lib/reservationRules.ts
// 予約の基本ルール・ユーティリティ（JST基準）
// - 受付ウィンドウ: 「利用日Dの前日12:00(JST) ～ 当日12:00(JST)」
// - 休園日: 土日・日本の祝日・年末年始(12/29～1/4)
// - time_slot: 00:00-11:59 -> "am", 12:00-23:59 -> "pm"

import { isJapanHoliday } from "@/lib/jpHolidays";

export const LIMITS = {
  daily: 6,
  am: 6,
  pm: 6,
} as const;

export type TimeSlot = "am" | "pm";
export const COUNT_STATUSES = ["pending", "approved"] as const;

const HOUR = 60 * 60 * 1000;

// 日付文字列 YYYY-MM-DD を UTC の 00:00 に解釈
export function parseYmd(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
}

// Date -> YYYY-MM-DD（UTCフィールドで安定化）
export function ymd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// 受付可能ウィンドウ判定（前日12:00(JST,=UTC+9) ～ 当日12:00(JST)）
export function withinBookingWindow(date: string | Date, now: Date = new Date()): boolean {
  const d = typeof date === "string" ? parseYmd(date) : new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // JSTの12:00はUTCの03:00
  const openUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - 1, 3)); // D-1 12:00(JST)
  const closeUTC = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 3));   // D 12:00(JST)
  return now >= openUTC && now < closeUTC;
}

// 休園日（週末・祝日・年末年始）の判定
export function isClosedDate(date: string | Date): boolean {
  const ds = typeof date === "string" ? date : ymd(date);
  const [y, m, d] = ds.split("-").map(Number);
  // JSTの日付として扱うために 09:00 UTC を基準に曜日を取る（その日の内部に確実に入る）
  const dow = new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 9)).getUTCDay(); // 0:Sun,6:Sat
  const weekend = dow === 0 || dow === 6;
  const yearEnd = (m === 12 && d! >= 29) || (m === 1 && d! <= 4);
  const holiday = isJapanHoliday(new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 9)));
  return weekend || holiday || yearEnd;
}

// "HH:MM" -> "am" | "pm" に変換（利用者の預け希望時刻を内部 period へ）
export function toPeriodFromTime(time: string | null | undefined): TimeSlot | null {
  if (!time) return null;
  const [hStr] = String(time).split(":");
  const h = Number(hStr);
  if (!Number.isFinite(h)) return null;
  return h < 12 ? "am" : "pm";
}

// 互換用エイリアス（過去コードで使っている可能性に対応）
export const slotFromTimeStr = toPeriodFromTime;

// 補助: 単純な可否（閉園でなく、かつ受付ウィンドウ内）
export function canAcceptForDate(date: string | Date, now: Date = new Date()): boolean {
  return !isClosedDate(date) && withinBookingWindow(date, now);
}
