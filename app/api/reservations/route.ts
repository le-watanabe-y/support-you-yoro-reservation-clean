// app/api/reservations/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  COUNT_STATUSES,
  LIMIT_DAILY,
  LIMIT_BY_PERIOD,
  toPeriodFromTime,
  canAcceptForDate,
  shouldAutoApprove,
} from "@/lib/reservationRules";

// GET: 予約一覧
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}

// POST: 予約登録
export async function POST(req: NextRequest) {
  const body = await req.json();

  const guardian_name = body?.guardianName ?? body?.guardian_name ?? "";
  const email = body?.email ?? null;
  const child_name = body?.childName ?? body?.child_name ?? null;
  const child_birthdate = body?.childBirthdate ?? body?.child_birthdate ?? null;
  const preferred_date = body?.preferredDate ?? body?.preferred_date ?? "";
  const dropoff_time = body?.dropoffTime ?? body?.dropoff_time ?? null;

  if (!guardian_name || !preferred_date) {
    return NextResponse.json(
      { ok: false, message: "必須項目（保護者氏名 / 利用日）が不足しています。" },
      { status: 400 }
    );
  }

  // 受付ウィンドウ & 休園日チェック
  if (!canAcceptForDate(preferred_date)) {
    return NextResponse.json(
      { ok: false, message: "休園日/受付時間外のため予約できません。" },
      { status: 400 }
    );
  }

  const period = toPeriodFromTime(dropoff_time); // 'am' | 'pm'

  // 日の使用数（pending+approved）
  const { count: dayUsed, error: dayErr } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferred_date)
    .in("status", COUNT_STATUSES as any);

  if (dayErr) return NextResponse.json({ ok: false, message: dayErr.message }, { status: 500 });
  if ((dayUsed ?? 0) >= LIMIT_DAILY) {
    return NextResponse.json({ ok: false, message: "1日の上限に達しました。" }, { status: 409 });
  }

  // 枠（AM/PM）の使用数（pending+approved）
  const { count: periodUsed, error: perErr } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferred_date)
    .eq("time_slot", period)
    .in("status", COUNT_STATUSES as any);

  if (perErr) return NextResponse.json({ ok: false, message: perErr.message }, { status: 500 });
  if ((periodUsed ?? 0) >= LIMIT_BY_PERIOD[period]) {
    return NextResponse.json({ ok: false, message: "該当時間帯の上限に達しました。" }, { status: 409 });
  }

  // 自動承認（approvedの件数のみを参照）
  const { count: approvedCount, error: appErr } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferred_date)
    .eq("status", "approved");

  if (appErr) return NextResponse.json({ ok: false, message: appErr.message }, { status: 500 });
  const status = shouldAutoApprove(approvedCount ?? 0) ? "approved" : "pending";

  const insert = {
    guardian_name,
    email,
    child_name,
    child_birthdate,
    preferred_date,
    dropoff_time,
    time_slot: period,
    status,
  };

  const { error: insErr } = await supabaseAdmin.from("reservations").insert(insert);
  if (insErr) return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, status });
}
