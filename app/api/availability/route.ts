// app/api/availability/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  isClosedDate,
  withinBookingWindow,
  toPeriodFromTime,
  COUNT_STATUSES,
  LIMIT_DAILY,
  LIMIT_BY_PERIOD,
} from "@/lib/reservationRules";

type Period = keyof typeof LIMIT_BY_PERIOD; // 'am' | 'pm'

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD（必須）
  const time = url.searchParams.get("time"); // HH:MM（任意）

  if (!date) {
    return NextResponse.json(
      { ok: false, message: 'query "date=YYYY-MM-DD" is required' },
      { status: 400 }
    );
  }

  // 基本判定
  const closed = isClosedDate(date);
  const within = withinBookingWindow(date);
  const period: Period | null = time ? toPeriodFromTime(time) : null;

  // カウント（DB）
  let dailyUsed = 0;
  let periodUsed = 0;

  if (!closed) {
    const { count: dCount, error: dErr } = await supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("preferred_date", date)
      .in("status", COUNT_STATUSES as any);
    if (dErr) return NextResponse.json({ ok: false, message: dErr.message }, { status: 500 });
    dailyUsed = dCount ?? 0;

    if (period) {
      const { count: pCount, error: pErr } = await supabaseAdmin
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("preferred_date", date)
        .eq("time_slot", period)
        .in("status", COUNT_STATUSES as any);
      if (pErr) return NextResponse.json({ ok: false, message: pErr.message }, { status: 500 });
      periodUsed = pCount ?? 0;
    }
  }

  // 上限
  const dailyLimit = LIMIT_DAILY ?? 6;
  const dailyRemaining = Math.max(0, dailyLimit - dailyUsed);

  const periodLimit = period ? (LIMIT_BY_PERIOD?.[period] ?? 6) : null;
  const periodRemaining = periodLimit != null ? Math.max(0, periodLimit - periodUsed) : null;

  // 予約可否
  let canReserve = !closed && within && dailyRemaining > 0;
  if (canReserve && periodRemaining != null) canReserve = periodRemaining > 0;

  return NextResponse.json({
    ok: true,
    date,
    time,
    period, // 'am' | 'pm' | null
    closed,
    withinBookingWindow: within,
    canReserve,
    daily: { used: dailyUsed, limit: dailyLimit, remaining: dailyRemaining },
    period: period
      ? { key: period, used: periodUsed, limit: periodLimit, remaining: periodRemaining }
      : null,
  });
}
