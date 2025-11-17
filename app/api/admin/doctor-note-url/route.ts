// app/api/admin/doctor-note-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 使い方（どちらか）:
 *  - /api/admin/doctor-note-url?id=<reservation_id>
 *  - /api/admin/doctor-note-url?path=<storage_path>   例) medical/resv/xxx/yyy.pdf
 * 成功時は署名URLに 302 リダイレクトします（10分有効）。
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  let path = searchParams.get("path") || "";

  try {
    // id が来たら DB からパスを引く
    if (!path && id) {
      const { data, error } = await supabaseAdmin
        .from("reservations")
        .select("doctor_note_path")
        .eq("id", id)
        .single();

      if (error) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
      }
      if (!data?.doctor_note_path) {
        return NextResponse.json({ ok: false, error: "no_doctor_note" }, { status: 404 });
      }
      path = data.doctor_note_path;
    }

    if (!path) {
      return NextResponse.json({ ok: false, error: "path_or_id_required" }, { status: 400 });
    }

    const { data: sig, error: sErr } = await supabaseAdmin
      .storage
      .from("medical")
      .createSignedUrl(path, 600); // 10分

    if (sErr || !sig?.signedUrl) {
      return NextResponse.json({ ok: false, error: sErr?.message || "sign_failed" }, { status: 500 });
    }

    // 直接リダイレクトする
    return NextResponse.redirect(sig.signedUrl, 302);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 });
  }
}
