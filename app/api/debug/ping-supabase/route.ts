import { NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";

export async function GET() {
  const s = supabaseAdmin; // ← 括弧なし
  const { data, error } = await s.from("reservations").select("id").limit(1);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rows: data?.length ?? 0 });
}
