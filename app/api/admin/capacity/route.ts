// app/api/admin/capacity/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST(req: Request) {
  const { day, capacity } = await req.json();
  if (!day || typeof capacity !== "number" || capacity < 0) {
    return NextResponse.json({ ok: false, message: "day / capacity が不正です" }, { status: 400 });
  }
  const { error } = await supabaseAdmin
    .from("capacities")
    .upsert({ day, capacity, updated_at: new Date().toISOString() });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
