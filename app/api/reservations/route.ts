// app/api/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMIT_DAILY,
  LIMIT_BY_PERIOD,
  COUNT_STATUSES,
  normalizeDate,
  withinOpenWindow,
  isClosedDate,
  isPeriod,
} from "@/lib/reservationRules";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // 旧フィールド名も受け付けて吸収
    const guardian_name = body.guardian_name ?? body.guardianName ?? "";
    const email = (body.email ?? "").trim();
    const guardian_phone = body.guardian_phone ?? body.guardianPhone ?? null;

    const child_name = body.child_name ?? body.childName ?? "";
    const child_birthdate = body.child_birthdate ?? body.childBirthdate ?? "";
    const child_allergy = body.child_allergy ?? body.childAllergy ?? null;

    const date = normalizeDate(body.date ?? body.preferredDate ?? "");
    const periodRaw = (body.period ?? body.timeSlot ?? "").toLowerCase();
    const period = isPeriod(periodRaw) ? periodRaw : "";

    const notes = body.notes ?? body.note ?? null;

    // 必須チェック
    const errors: Record<string, string> = {};
    if (!guardian_name) errors.guardian_name = "保護者名は必須です。";
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) errors.email = "メール形式が不正です。";
    if (!child_name) errors.child_name = "お子さまの氏名は必須です。";
    if (!child_birthdate || !/^\d{4}-\d{2}-\d{2}$/.test(child_birthdate))
      errors.child_birthdate = "お子さまの生年月日は YYYY-MM-DD で入力してください。";
    if (!date) errors.date = "希望日は必須です。";
    if (!period) errors.period = "午前/午後を選択してください。";

    if (Object.keys(errors).length) {
      return NextResponse.json({ ok: false, message: "入力不備があります。", errors }, { status: 400 });
    }

    // 受付期間＆休園日
    if (!withinOpenWindow(date)) {
      return NextResponse.json({ ok: false, message: "受付期間外の日付です。" }, { status: 400 });
    }
    if (isClosedDate(date)) {
      return NextResponse.json({ ok: false, message: "休園日のため予約できません。" }, { status: 400 });
    }

    // 同一児童＆同日 重複チェック（pending/approved のみ）
    const { count: dupCount, error: dupErr } = await supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("date", date)
      .eq("child_name", child_name)
      .eq("child_birthdate", child_birthdate)
      .in("status", COUNT_STATUSES as any);

    if (dupErr) {
      return NextResponse.json({ ok: false, message: dupErr.message }, { status: 500 });
    }
    if ((dupCount ?? 0) > 0) {
      return NextResponse.json(
        { ok: false, message: "同じお子さまの同日予約が既にあります。" },
        { status: 409 }
      );
    }

    // 定員チェック（当日総数 + period）
    const { data: todayRows, error: todayErr } = await supabaseAdmin
      .from("reservations")
      .select("period")
      .eq("date", date)
      .in("status", COUNT_STATUSES as any);

    if (todayErr) {
      return NextResponse.json({ ok: false, message: todayErr.message }, { status: 500 });
    }

    const total = todayRows?.length ?? 0;
    const per = (todayRows ?? []).filter((r: any) => r.period === period).length;

    if (total >= LIMIT_DAILY) {
      return NextResponse.json({ ok: false, message: "当日の定員に達しています。" }, { status: 409 });
    }
    if (period === "am" && per >= LIMIT_BY_PERIOD.am) {
      return NextResponse.json({ ok: false, message: "午前の定員に達しています。" }, { status: 409 });
    }
    if (period === "pm" && per >= LIMIT_BY_PERIOD.pm) {
      return NextResponse.json({ ok: false, message: "午後の定員に達しています。" }, { status: 409 });
    }

    // 登録（初期ステータスは pending）
    const payload = {
      guardian_name,
      email,
      guardian_phone,
      child_name,
      child_birthdate,
      child_allergy,
      date,
      period,
      status: "pending",
      notes,
    };

    const { data, error } = await supabaseAdmin
      .from("reservations")
      .insert([payload])
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data.id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "server error" }, { status: 500 });
  }
}
