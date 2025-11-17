// app/api/admin/capacity/route.ts
import { NextResponse } from "next/server";
import getSupabaseAdmin from "@/lib/supabaseAdmin";

// ビルド時に事前実行しない（SSG/ISR を避ける）
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const s = getSupabaseAdmin();

    // ここでは最低限の疎通確認に留める（本来の集計ロジックは元のままでOK）
    const { error } = await s.from("reservations").select("id", { count: "exact", head: true }).limit(1);
    if (error) throw error;

    // 必要であれば capacity の実計算をここへ（元の実装があれば差し替え）
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
