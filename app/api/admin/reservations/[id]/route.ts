import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// PATCH /api/admin/reservations/:id
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const { status } = (await req.json()) as {
    status: "approved" | "rejected" | "canceled";
  };

  if (!["approved", "rejected", "canceled"].includes(status)) {
    return NextResponse.json({ ok: false, message: "invalid status" }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("reservations")
    .update({ status })
    .eq("id", params.id);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
