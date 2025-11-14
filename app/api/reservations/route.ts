// app/api/reservations/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const COUNT_STATUSES = ["pending", "approved"] as const;

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
    const {
      guardianName,
      email,
      preferredDate,
      notes,
      childName,
      childBirthdate,
      childAllergy,
      guardianPhone,
    } = body ?? {};

    if (!guardianName || !email || !preferredDate) {
      return NextResponse.json(
        { ok: false, message: "必須項目（保護者名 / メール / 希望日）が足りません" },
        { status: 400 },
      );
    }

    // 定員取得
    const { data: capRow } = await supabaseAdmin
      .from("capacities")
      .select("capacity")
      .eq("day", preferredDate)
      .maybeSingle();

    const fallback = Number(process.env.DEFAULT_DAILY_CAPACITY ?? "0");
    const capacity = capRow?.capacity ?? fallback;

    // その日の予約数（pending + approved）
    const { count, error: cntErr } = await supabaseAdmin
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("preferred_date", preferredDate)
      .in("status", COUNT_STATUSES as unknown as string[]);

    if (cntErr) {
      return NextResponse.json({ ok: false, message: cntErr.message }, { status: 500 });
    }

    const booked = count ?? 0;
    if (capacity > 0 && booked >= capacity) {
      return NextResponse.json(
        { ok: false, message: "この日は満席です。別の日をご選択ください。" },
        { status: 409 },
      );
    }

    // 登録（初期状態は pending）
    const { data, error } = await supabaseAdmin
      .from("reservations")
      .insert({
        guardian_name: guardianName,
        email,
        preferred_date: preferredDate,
        notes: notes ?? "",
        status: "pending",
        child_name: childName ?? null,
        child_birthdate: childBirthdate ?? null,
        child_allergy: childAllergy ?? null,
        guardian_phone: guardianPhone ?? null,
      })
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id ?? null }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "failed" }, { status: 500 });
  }
}
