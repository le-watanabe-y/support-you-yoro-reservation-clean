export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LIMIT_DAILY, LIMIT_BY_PERIOD, COUNT_STATUSES, isClosedDate, withinBookingWindow } from "@/lib/reservationRules";

async function isManuallyClosed(date: string) {
  const { data } = await supabaseAdmin.from("booking_overrides").select("is_open").eq("date", date).maybeSingle();
  return data ? data.is_open === false : false;
}

export async function GET(req: NextRequest) {
  const date = new URL(req.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, message: "date is required (YYYY-MM-DD)" }, { status: 400 });
  }
  const dailyLimit = LIMIT_DAILY ?? 6;
  const manualClosed = await isManuallyClosed(date);
  const holidayClosed = isClosedDate(date);
  const closed = manualClosed || holidayClosed;
  const win = withinBookingWindow(date);

  const used = { daily: 0, am: 0, pm: 0 };
  const { count: dailyUsed } = await supabaseAdmin
    .from("reservations").select("id", { count: "exact", head: true })
    .eq("preferred_date", date).in("status", COUNT_STATUSES as any);
  used.daily = dailyUsed ?? 0;

  for (const p of ["am","pm"] as const) {
    const { count } = await supabaseAdmin
      .from("reservations").select("id", { count: "exact", head: true })
      .eq("preferred_date", date).eq("time_slot", p).in("status", COUNT_STATUSES as any);
    used[p] = count ?? 0;
  }

  return NextResponse.json({
    ok: true,
    date,
    closed,
    manualClosed,
    withinBookingWindow: win,
    remaining: {
      daily: Math.max(0, dailyLimit - used.daily),
      am: Math.max(0, (LIMIT_BY_PERIOD.am ?? 6) - used.am),
      pm: Math.max(0, (LIMIT_BY_PERIOD.pm ?? 6) - used.pm),
    },
    canReserve: !closed && win,
  });
}
