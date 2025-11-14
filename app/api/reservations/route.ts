// app/api/reservations/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMITS,
  parseYmd,
  canAcceptForDate,
  limitFor,
  shouldAutoApprove,
  slotFromTimeStr,
  TimeSlot,
} from "@/lib/reservationRules";

function isCountStatus(s: string | null): boolean {
  return (LIMITS.countStatuses as readonly string[]).includes(String(s));
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const guardian_name = (body.guardian_name ?? body.guardianName ?? "").trim();
    const email = (body.email ?? "").trim();
    const child_name = (body.child_name ?? body.childName ?? "").trim(); // 任意。あれば重複判定に利用
    const preferred_date = (body.preferred_date ?? body.preferredDate ?? "").trim();
    const dropoff_time = (body.dropoff_time ?? body.dropoffTime ?? "").trim(); // "HH:mm"
    const notes = body.notes ?? null;

    if (!guardian_name || !email || !preferred_date || !dropoff_time) {
      return NextResponse.json(
        { ok: false, message: "必須項目（保護者名/メール/希望日/希望時間）が足りません。" },
        { status: 400 }
      );
    }

    const d = parseYmd(preferred_date);
    if (!d) return NextResponse.json({ ok: false, message: "日付形式が不正です。" }, { status: 400 });

    const slot: TimeSlot = slotFromTimeStr(dropoff_time); // サーバ側でAM/PMを自動分類

    const win = canAcceptForDate(d);
    if (!win.ok) {
      const msg = win.reason === "closed" ? "休園日のため予約できません。" : "受付期間外のため予約できません。";
      return NextResponse.json({ ok: false, message: msg }, { status: 400 });
    }

    // 同一児童の同日重複（child_name が送られてきた場合のみ判定）
    if (child_name) {
      const { data: dup, error: dupErr } = await supabaseAdmin
        .from("reservations")
        .select("id,status")
        .eq("preferred_date", preferred_date)
        .eq("child_name", child_name);
      if (dupErr) return NextResponse.json({ ok: false, message: dupErr.message }, { status: 500 });
      const exists = (dup ?? []).some((r: any) => r.status !== "canceled" && r.status !== "rejected");
      if (exists) {
        return NextResponse.json(
          { ok: false, message: "同一児童の同日予約はすでに申込済みです。" },
          { status: 400 }
        );
      }
    }

    // 在庫判定
    const { data: sameDay, error: dayErr } = await supabaseAdmin
      .from("reservations")
      .select("id,status,time_slot")
      .eq("preferred_date", preferred_date);
    if (dayErr) return NextResponse.json({ ok: false, message: dayErr.message }, { status: 500 });

    const counted = (sameDay ?? []).filter((r: any) => isCountStatus(r.status));
    const dayCount = counted.length;
    const slotCount = counted.filter((r: any) => r.time_slot === slot).length;

    if (dayCount >= LIMITS.day || slotCount >= limitFor(slot)) {
      return NextResponse.json({ ok: false, message: "満員のため予約できません。" }, { status: 400 });
    }

    // 自動承認（先着2名）
    const approvedCountForDay = (sameDay ?? []).filter((r: any) => r.status === "approved").length;
    const status = shouldAutoApprove(approvedCountForDay) ? "approved" : "pending";

    // 登録
    const payload: any = {
      guardian_name,
      email,
      child_name: child_name || null,
      preferred_date,
      dropoff_time,       // 新列に保存
      time_slot: slot,    // 管理側の在庫は引き続きAM/PMでカウント
      status,
      notes,
    };

    const { data: inserted, error: insErr } = await supabaseAdmin
      .from("reservations")
      .insert(payload)
      .select("id,status")
      .single();
    if (insErr) return NextResponse.json({ ok: false, message: insErr.message }, { status: 500 });

    return NextResponse.json({
      ok: true,
      id: inserted?.id,
      status: inserted?.status,
      message: inserted?.status === "approved"
        ? "予約を受付けました（承認済み）。"
        : "予約を受付けました（ただいま待機です）。",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "エラーが発生しました" }, { status: 500 });
  }
}
