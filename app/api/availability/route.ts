// app/api/availability/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMIT_DAILY,
  LIMIT_BY_PERIOD,
  COUNT_STATUSES,
  normalizeDate,
  isClosedDate,
  withinOpenWindow,
  isPeriod,
} from "@/lib/reservationRules";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = normalizeDate(url.searchParams.get("date") || "");

  if (!date) {
    return NextResponse.json({ ok: false, message: "date is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("period,status")
    .eq("date", date)
    .in("status", COUNT_STATUSES as any);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const counts = { total: 0, am: 0, pm: 0 };
  for (const r of data ?? []) {
    counts.total += 1;
    const p = (r as any).period;
    if (isPeriod(p)) counts[p] += 1;
  }

  const left = {
    total: Math.max(0, LIMIT_DAILY - counts.total),
    am: Math.max(0, LIMIT_BY_PERIOD.am - counts.am),
    pm: Math.max(0, LIMIT_BY_PERIOD.pm - counts.pm),
  };

  const available = {
    am: left.am > 0 && left.total > 0,
    pm: left.pm > 0 && left.total > 0,
  };

  return NextResponse.json({
    ok: true,
    date,
    limits: { daily: LIMIT_DAILY, periods: LIMIT_BY_PERIOD },
    counts,
    left,
    available,
    canReserve: withinOpenWindow(date) && !isClosedDate(date),
  });
}
