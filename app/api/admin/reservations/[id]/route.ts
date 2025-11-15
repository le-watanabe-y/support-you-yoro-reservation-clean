// app/api/admin/reservations/[id]/route.ts（全置き換え）
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { okAuth } from "@/lib/config";

const ALLOWED = ["pending", "approved", "rejected", "canceled"] as const;
type Status = (typeof ALLOWED)[number];

export async function PATCH(
  req: NextRequest,
  ctx: { params: { id: string } }
) {
  if (!okAuth(req)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const id = ctx.params?.id;
  const body = await req.json().catch(() => ({}));
  const status: Status | undefined = body?.status;

  if (!id || !status || !ALLOWED.includes(status)) {
    return NextResponse.json({ ok: false, message: "bad request" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({ status })
    .eq("id", id);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
