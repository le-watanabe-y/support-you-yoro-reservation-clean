// app/api/availability/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMIT_DAILY,
  LIMIT_BY_PERIOD,
  COUNT_STATUSES,
  isClosedDate,          // 祝日/土日・年末年始
  withinBookingWindow,   // 正午ルール（当日 or 翌日のみ）
} from "@/lib/reservationRules";

type Period = keyof typeof LIMIT_BY_PERIOD; // 'am' | 'pm'

function toPeriodFromTime(hhmm: string): Period {
  // AM/PM区分は内部用： 00:00-11:59 = am / 12:00-23:59 = pm
  const [h] = hhmm.split(":").map((s) => parseInt(s, 10));
  return h < 12 ? "am" : "pm";
}

async function isManuallyClosed(date: string) {
  const { data, error } = await supabaseAdmin
    .from("booking_overrides")
    .select("is_open")
    .eq("date", date)
    .maybeSingle();
  if (error) return false;
  return data ? data.is_open === false : false;
}

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, message: "date is required (YYYY-MM-DD)" }, { status: 400 });
  }

  const dailyLimit = LIMIT_DAILY ?? 6;

  // 手動停止 or 祝日/休園判定
  const manualClosed = await isManuallyClosed(date);
  const holidayClosed = isClosedDate(date);
  const closed = manualClosed || holidayClosed;

  // 受付ウィンドウ（正午ルール）
  const win = withinBookingWindow(date);

  // 使用数を集計
  const used = { daily: 0, am: 0, pm: 0 };

  // 1日合計
  const { count: dailyUsed } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", date)
    .in("status", COUNT_STATUSES as any);
  used.daily = dailyUsed ?? 0;

  // AM/PM
  for (const p of ["am", "pm"] as const) {
    const { count } = await supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("preferred_date", date)
      .eq("time_slot", p)
      .in("status", COUNT_STATUSES as any);
    used[p] = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    date,
    closed,                     // true なら休園 or 手動停止
    manualClosed,
    withinBookingWindow: win,   // 受付時間内（正午ルール）
    remaining: {
      daily: Math.max(0, dailyLimit - used.daily),
      am: Math.max(0, (LIMIT_BY_PERIOD.am ?? 6) - used.am),
      pm: Math.max(0, (LIMIT_BY_PERIOD.pm ?? 6) - used.pm),
    },
    canReserve: !closed && win,
  });
}
