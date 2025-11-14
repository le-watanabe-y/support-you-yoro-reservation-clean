// app/api/admin/reservations/[id]/status/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const status = body?.status as
      | "pending"
      | "approved"
      | "rejected"
      | "cancelled";

    if (!id || !status || !["pending", "approved", "rejected", "cancelled"].includes(status)) {
      return NextResponse.json({ ok: false, message: "invalid id or status" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("reservations")
      .update({ status })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "server error" }, { status: 500 });
  }
}
