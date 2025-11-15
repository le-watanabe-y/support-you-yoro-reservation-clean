// app/api/admin/export/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function basicOk(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;
  const [user, pass] = Buffer.from(auth.slice(6), "base64").toString().split(":");
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}

export async function GET(req: NextRequest) {
  if (!basicOk(req)) return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin.from("reservations").select("*").order("preferred_date", { ascending: true });
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}
