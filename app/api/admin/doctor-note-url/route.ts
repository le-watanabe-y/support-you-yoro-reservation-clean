// app/api/admin/doctor-note-url/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { okAuth } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    if (!okAuth(req)) return new NextResponse("unauthorized", { status: 401 });

    const { searchParams } = new URL(req.url);
    const path = searchParams.get("path");
    if (!path) return NextResponse.json({ ok: false, message: "path is required" }, { status: 400 });

    const s = supabaseAdmin();
    const { data, error } = await s.storage
      .from("doctor-notes")
      .createSignedUrl(path, 60 * 5); // 5分

    if (error) throw error;
    return NextResponse.json({ ok: true, url: data?.signedUrl });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? String(e) }, { status: 500 });
  }
}
