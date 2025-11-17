// app/api/admin/capacity/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const s = supabaseAdmin; // ← 括弧なし（呼び出していない）
    const { error } = await s
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .limit(1);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
