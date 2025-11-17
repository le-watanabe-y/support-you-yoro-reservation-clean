// app/api/admin/reservations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { okAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    if (!okAuth(req)) return new NextResponse("unauthorized", { status: 401 });

    const id = params.id;
    const updates = await req.json();
    const s = supabaseAdmin();

    // 承認しようとしたら、添付必須
    if (updates?.status === "approved") {
      const { data: r, error } = await s
        .from("reservations")
        .select("doctor_note_path")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (!r?.doctor_note_path) {
        return NextResponse.json(
          { ok: false, message: "医師連絡表の添付が必要です（承認できません）" },
          { status: 400 }
        );
      }
    }

    const { error: upError } = await s.from("reservations").update(updates).eq("id", id);
    if (upError) throw upError;

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? String(e) }, { status: 500 });
  }
}
