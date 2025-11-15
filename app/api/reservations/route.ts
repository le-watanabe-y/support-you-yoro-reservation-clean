export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMIT_DAILY, LIMIT_BY_PERIOD, COUNT_STATUSES,
  isClosedDate, withinBookingWindow, toPeriodFromTime,
  type Period
} from "@/lib/reservationRules";

type Status = "pending" | "approved" | "rejected" | "canceled";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, message: msg }, { status });
}
async function isManuallyClosed(date: string) {
  const { data } = await supabaseAdmin
    .from("booking_overrides")
    .select("is_open")
    .eq("date", date)
    .maybeSingle();
  return data ? data.is_open === false : false;
}

export async function GET(req: NextRequest) {
  const u = new URL(req.url);
  const date = u.searchParams.get("date"); // 任意
  let q = supabaseAdmin
    .from("reservations")
    .select("id,status,preferred_date,dropoff_time,guardian_name,email,child_name,child_birthdate,created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (date) q = q.eq("preferred_date", date);
  const { data, error } = await q;
  if (error) return bad(error.message, 500);
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); } catch { return bad("invalid json"); }

  const guardianName = (body.guardianName || body.guardian_name || "").trim();
  const email = (body.email || "").trim();
  const childName = (body.childName || body.child_name || null) as string | null;
  const childBirthdate = (body.childBirthdate || body.child_birthdate || null) as string | null;
  const preferredDate = (body.preferredDate || body.preferred_date || "").trim(); // YYYY-MM-DD
  const dropoffTime = (body.dropoffTime || body.dropoff_time || "").trim();       // HH:MM

  if (!guardianName || !email || !preferredDate || !dropoffTime) {
    return bad("必須項目（保護者名 / メール / 日付 / 時刻）が足りません。");
  }

  if (isClosedDate(preferredDate)) return bad("休園日のため予約できません。");
  if (await isManuallyClosed(preferredDate)) return bad("該当日は受付停止中です。");
  if (!withinBookingWindow(preferredDate)) return bad("受付時間外のため予約できません。");

  const period: Period = toPeriodFromTime(dropoffTime);

  if (childName && childBirthdate) {
    const { count } = await supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("preferred_date", preferredDate)
      .eq("child_name", childName)
      .eq("child_birthdate", childBirthdate)
      .in("status", COUNT_STATUSES as any);
    if ((count ?? 0) > 0) return bad("同じお子さまの同日予約がすでにあります。");
  }

  const { count: dailyUsed } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferredDate)
    .in("status", COUNT_STATUSES as any);
  if ((dailyUsed ?? 0) >= (LIMIT_DAILY ?? 6)) return bad("本日の枠は満席です。");

  const { count: slotUsed } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferredDate)
    .eq("time_slot", period)
    .in("status", COUNT_STATUSES as any);
  if ((slotUsed ?? 0) >= (LIMIT_BY_PERIOD?.[period] ?? 6)) {
    return bad("指定の時間帯は満席です。別の時刻をご検討ください。");
  }

  const autoApproveThreshold = 2;
  const status: Status = (dailyUsed ?? 0) < autoApproveThreshold ? "approved" : "pending";

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .insert({
      guardian_name: guardianName,
      email,
      child_name: childName,
      child_birthdate: childBirthdate,
      preferred_date: preferredDate,
      dropoff_time: dropoffTime,
      time_slot: period,
      status,
    })
    .select()
    .single();
  if (error) return bad(error.message, 500);

  return NextResponse.json({ ok: true, id: data.id, status });
}
