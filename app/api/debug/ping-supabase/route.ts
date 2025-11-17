import { NextResponse } from "next/server";
import getSupabaseAdmin from "@/lib/supabaseAdmin";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const s = getSupabaseAdmin();
    const { data, error } = await s.from("reservations").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true, rows: data?.length ?? 0 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? String(e) }, { status: 500 });
  }
}
