// app/api/admin/reservations/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { okAuth } from "@/lib/adminAuth";

type Params = { params: { id: string } };

export async function PATCH(req: NextRequest, { params }: Params) {
  if (!okAuth(req)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": 'Basic realm="admin"' } });
  }
  const id = params.id;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid json" }, { status: 400 });
  }
  const status = String(body?.status || "");

  const ALLOWED = new Set(["pending", "approved", "rejected", "canceled"]);
  if (!ALLOWED.has(status)) {
    return NextResponse.json({ ok: false, message: "invalid status" }, { status: 400 });
  }

  // 変数としてそのまま使う（関数呼び出ししない）
  const s = supabaseAdmin;
  const { error } = await s.from("reservations").update({ status }).eq("id", id);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
