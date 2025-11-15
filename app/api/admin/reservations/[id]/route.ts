// app/api/admin/reservations/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = params.id;
  const updates = await req.json(); // 例: { status: "approved" }

  const { error } = await supabaseAdmin.from("reservations").update(updates).eq("id", id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
