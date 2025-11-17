import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    const body = await req.json();
    const status = String(body?.status ?? "");

    if (!id) return NextResponse.json({ ok: false, message: "id がありません" }, { status: 400 });
    if (!["approved", "rejected", "canceled", "pending"].includes(status)) {
      return NextResponse.json({ ok: false, message: "不正な status です" }, { status: 400 });
    }

    if (status === "approved") {
      const { data: r, error: rErr } = await supabase
        .from("reservations")
        .select("medical_letter_path")
        .eq("id", id)
        .single();
      if (rErr) return NextResponse.json({ ok: false, message: rErr.message }, { status: 500 });
      if (!r?.medical_letter_path) {
        return NextResponse.json(
          { ok: false, message: "医師連絡表が添付されていないため承認できません。" },
          { status: 400 }
        );
      }
    }

    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "server error" }, { status: 500 });
  }
}
