// app/api/availability/route.ts
import { NextResponse, NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  normalizeDate,
  isClosedDate,
  withinOpenWindow,
  LIMIT_DAILY,
  LIMIT_BY_PERIOD,
  type Period,
} from "@/lib/reservationRules";

const COUNT_STATUSES = ["pending", "approved"]; // 定員に数えるステータス（ご指定 b）

function periodFromTime(time?: string | null): Period {
  if (!time) return "am";
  const h = Number(time.split(":")[0] ?? "9");
  return h < 12 ? "am" : "pm";
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date") ?? "";
  const timeParam = url.searchParams.get("time"); // "HH:mm"（任意）

  const date = normalizeDate(dateParam);
  if (!date) {
    return NextResponse.json({ ok: false, message: "date=YYYY-MM-DD を指定してください" }, { status: 400 });
  }

  const closed = isClosedDate(date);
  const withinWindow = withinOpenWindow(date);

  // まずは closed / withinWindow を早期返却可能
  if (closed || !withinWindow) {
    return NextResponse.json({
      ok: true,
      date,
      closed,
      withinWindow,
      canReserve: false,
      reason: closed ? "closed" : "out_of_window",
    });
  }

  const p = periodFromTime(timeParam);

  // ---- 定員計算（daily / period）-------------------------------------------
  // daily
  const daily = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("date", date)
    .in("status", COUNT_STATUSES);
  const dailyCount = daily.count ?? 0;

  // period（dropoff_time < 12:00 を AM とみなす /  >= 12:00 を PM）
  const periodExpr =
    p === "am" ? "dropoff_time.lt.12:00,time_slot.eq.am" : "dropoff_time.gte.12:00,time_slot.eq.pm";
  const per = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("date", date)
    .in("status", COUNT_STATUSES)
    .or(periodExpr);
  const periodCount = per.count ?? 0;

  const remainDaily = Math.max(0, LIMIT_DAILY - dailyCount);
  const remainPeriod = Math.max(0, LIMIT_BY_PERIOD[p] - periodCount);
  const canReserve = remainDaily > 0 && remainPeriod > 0;

  return NextResponse.json({
    ok: true,
    date,
    time: timeParam ?? null,
    period: p,
    closed,
    withinWindow,
    canReserve,
    capacity: {
      daily: { used: dailyCount, limit: LIMIT_DAILY, remain: remainDaily },
      [p]:   { used: periodCount, limit: LIMIT_BY_PERIOD[p], remain: remainPeriod },
    },
  });
}
