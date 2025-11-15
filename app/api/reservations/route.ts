// app/api/reservations/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMIT_DAILY,
  LIMIT_BY_PERIOD,
  COUNT_STATUSES,
  isClosedDate,
  withinBookingWindow,
  toPeriodFromTime,
} from "@/lib/reservationRules";

type Status = "pending" | "approved" | "rejected" | "canceled";
type Period = keyof typeof LIMIT_BY_PERIOD;

async function isManuallyClosed(date: string) {
  const { data } = await supabaseAdmin
    .from("booking_overrides")
    .select("is_open")
    .eq("date", date)
    .maybeSingle();
  return data ? data.is_open === false : false;
}

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, message: msg }, { status });
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

  // 休園・受付ウィンドウ・手動停止
  if (isClosedDate(preferredDate)) return bad("休園日のため予約できません。");
  if (await isManuallyClosed(preferredDate)) return bad("該当日は受付停止中です。");
  if (!withinBookingWindow(preferredDate)) return bad("受付時間外のため予約できません。");

  // 時間帯判定
  const period: Period = toPeriodFromTime(dropoffTime);

  // 同日・同児童の重複
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

  // その日の使用数
  const { count: dailyUsed } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferredDate)
    .in("status", COUNT_STATUSES as any);

  const dailyLimit = LIMIT_DAILY ?? 6;
  if ((dailyUsed ?? 0) >= dailyLimit) return bad("本日の枠は満席です。");

  // 時間帯の使用数
  const { count: slotUsed } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferredDate)
    .eq("time_slot", period)
    .in("status", COUNT_STATUSES as any);

  const slotLimit = LIMIT_BY_PERIOD?.[period] ?? 6;
  if ((slotUsed ?? 0) >= slotLimit) return bad("指定の時間帯は満席です。別の時刻をご検討ください。");

  // 自動承認（先着2名）
  const autoApproveThreshold = 2;
  const status: Status = (dailyUsed ?? 0) < autoApproveThreshold ? "approved" : "pending";

  // 予約作成
  const insert = {
    guardian_name: guardianName,
    email,
    child_name: childName,
    child_birthdate: childBirthdate,
    preferred_date: preferredDate,
    dropoff_time: dropoffTime,
    time_slot: period,
    status,
  };
  const { data, error } = await supabaseAdmin.from("reservations").insert(insert).select().single();
  if (error) return bad(error.message, 500);

  return NextResponse.json({ ok: true, id: data.id, status });
}
