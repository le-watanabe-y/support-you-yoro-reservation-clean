// lib/config.ts
export type SlotKey = "am" | "pm";
export type StatusKey = "pending" | "approved" | "rejected" | "canceled";

export const RESERVATION_RULES = {
  // 基本
  timeZone: "Asia/Tokyo" as const,

  // 枠数
  dayTotalCap: 6, // 1日の総上限
  slots: [
    { key: "am" as SlotKey, label: "午前", capacity: 6 },
    { key: "pm" as SlotKey, label: "午後", capacity: 6 },
  ],

  // 定員に数えるステータス（b を選択）
  countedStatuses: ["pending", "approved"] as StatusKey[],

  // 受付ウインドウ（ターゲット日 D の予約は D-1 の 12:00 〜 D の 12:00 JST）
  bookingWindow: {
    openOffsetDays: -1,  // D-1
    openHourJst: 12,     // 12:00
    closeOffsetDays: 0,  // D
    closeHourJst: 12,    // 12:00
  },

  // 休園日
  closedWeekdays: ["Sat", "Sun"] as const, // 土日休み
  closeOnJpHolidays: true,                 // 祝日クローズ（※祝日判定の実装は次段）
  closedFixedRanges: [
    // 年末年始（12/29〜1/4）
    { from: { month: 12, day: 29 }, to: { month: 1, day: 4 } },
  ],

  // 同一お子さまの同日重複申込ブロック
  blockDuplicatePerChildPerDay: true,
} as const;
