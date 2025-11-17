// app/api/debug/ping-supabase/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const s = supabaseAdmin; // ← 定数をそのまま使う（関数ではない）

    // 軽い到達確認：count だけ head で取る
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
