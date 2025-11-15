export const runtime = "nodejs";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_req: NextRequest, { params }: { params: { date: string } }) {
  const { data, error } = await supabaseAdmin.from("booking_overrides").select("*").eq("date", params.date).maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data ?? { date: params.date, is_open: true, note: null } });
}

export async function PATCH(req: NextRequest, { params }: { params: { date: string } }) {
  let body: any; try { body = await req.json(); } catch { return NextResponse.json({ ok:false, message:"invalid json" }, { status: 400 }); }
  if (typeof body?.is_open !== "boolean") return NextResponse.json({ ok:false, message:"is_open required" }, { status: 400 });
  const { data, error } = await supabaseAdmin
    .from("booking_overrides")
    .upsert({ date: params.date, is_open: body.is_open, note: body?.note ?? null }, { onConflict: "date" })
    .select("*").single();
  if (error) return NextResponse.json({ ok:false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, item: data });
}
