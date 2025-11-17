// app/api/admin/capacity/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    // Supabase クライアント（括弧なし／呼び出しではない）
    const s = supabaseAdmin;

    // 接続疎通の軽いチェック（実際の集計ロジックは別途差し替え可）
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
