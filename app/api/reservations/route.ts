import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMITS,
  parseYmd,
  canAcceptForDate,
  limitFor,
  shouldAutoApprove,
  slotFromTimeStr,           // 旧名互換
  COUNT_STATUSES,
  TimeSlot,
} from "@/lib/reservationRules";

type Payload = {
  guardianName: string;
  email: string;
  preferredDate: string; // YYYY-MM-DD
  notes?: string;
  dropoff_time?: string; // "HH:mm"
  child_name?: string;
};

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { ok: false, message: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    const ymd = parseYmd(body.preferredDate);
    if (!body.guardianName || !body.email || !ymd) {
      return NextResponse.json(
        { ok: false, message: "必須項目（氏名/メール/希望日）が足りません。" },
        { status: 400 }
      );
    }

    // 受付ウィンドウ + 休園日
    if (!canAcceptForDate(ymd)) {
      return NextResponse.json(
        { ok: false, message: "受付期間外または休園日のため予約できません。" },
        { status: 400 }
      );
    }

    // 利用者入力の時刻から am/pm を推定（管理用）
    const slot: TimeSlot = slotFromTimeStr(body.dropoff_time || "09:00");

    // 当日/枠の混雑状況を取得
    const { data: rows, error: qErr } = await supabaseAdmin
      .from("reservations")
      .select("id, time_slot, status")
      .eq("preferred_date", ymd)
      .in("status", [...COUNT_STATUSES] as string[]);

    if (qErr) {
      return NextResponse.json(
        { ok: false, message: qErr.message },
        { status: 500 }
      );
    }

    const dayCount = rows?.length ?? 0;
    const slotCount = (rows || []).filter((r) => r.time_slot === slot).length;
    const approvedCount = (rows || []).filter((r) => r.status === "approved")
      .length;

    // 満員チェック
    if (dayCount >= limitFor(null) || slotCount >= limitFor(slot)) {
      return NextResponse.json(
        {
          ok: false,
          message: "満員のため申し込めません。",
          limits: { daily: LIMITS.daily, [slot]: LIMITS[slot] },
          used: { daily: dayCount, [slot]: slotCount },
        },
        { status: 409 }
      );
    }

    const status = shouldAutoApprove(approvedCount) ? "approved" : "pending";

    const insert = {
      guardian_name: body.guardianName,
      email: body.email,
      preferred_date: ymd,
      notes: body.notes ?? "",
      dropoff_time: body.dropoff_time || null,
      time_slot: slot,
      status,
      created_at: new Date().toISOString(),
      child_name: body.child_name ?? null,
    };

    const { data: created, error: insErr } = await supabaseAdmin
      .from("reservations")
      .insert(insert)
      .select("id")
      .single();

    if (insErr) {
      return NextResponse.json(
        { ok: false, message: insErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { ok: true, id: created?.id ?? null, status },
      { status: 201 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "サーバーエラー" },
      { status: 500 }
    );
  }
}
