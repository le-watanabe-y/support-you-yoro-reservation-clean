// app/api/admin/overrides/[date]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// GET /api/admin/overrides/2025-12-01 → { date, is_open, note }
export async function GET(
  _req: NextRequest,
  { params }: { params: { date: string } }
) {
  const d = params.date;
  const { data, error } = await supabaseAdmin
    .from("booking_overrides")
    .select("*")
    .eq("date", d)
    .maybeSingle();
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data ?? { date: d, is_open: true, note: null } });
}

// PATCH /api/admin/overrides/2025-12-01  { is_open: boolean, note?: string }
export async function PATCH(
  req: NextRequest,
  { params }: { params: { date: string } }
) {
  const d = params.date;
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ ok:false, message:"invalid json" }, { status: 400 }); }
  const is_open = typeof body?.is_open === "boolean" ? body.is_open : null;
  const note = typeof body?.note === "string" ? body.note : null;
  if (is_open === null) return NextResponse.json({ ok:false, message:"is_open required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("booking_overrides")
    .upsert({ date: d, is_open, note }, { onConflict: "date" })
    .select("*")
    .single();
  if (error) return NextResponse.json({ ok:false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok:true, item: data });
}
