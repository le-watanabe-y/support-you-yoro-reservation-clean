import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: NextRequest) {
  try {
    if (!(req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      return NextResponse.json({ ok: false, message: "multipart/form-data で送信してください" }, { status: 400 });
    }

    const form = await req.formData();

    const guardian_name = String(form.get("guardian_name") ?? "");
    const guardian_phone = String(form.get("guardian_phone") ?? "");
    const child_name = String(form.get("child_name") ?? "");
    const child_birthdate = String(form.get("child_birthdate") ?? "");
    const preferred_date = String(form.get("preferred_date") ?? "");
    const dropoff_time = String(form.get("dropoff_time") ?? "");

    const file = form.get("medical_letter");
    if (!(file instanceof Blob)) {
      return NextResponse.json({ ok: false, message: "医師連絡表（画像 / PDF）の添付が必須です。" }, { status: 400 });
    }

    const mime = file.type || "application/octet-stream";
    const okTypes = ["image/png", "image/jpeg", "application/pdf"];
    if (!okTypes.includes(mime)) {
      return NextResponse.json({ ok: false, message: "PNG / JPG / PDF のみ添付可能です。" }, { status: 400 });
    }
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ ok: false, message: "ファイルサイズは 5MB 以内にしてください。" }, { status: 400 });
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = mime === "application/pdf" ? "pdf" : mime === "image/png" ? "png" : "jpg";
    const filename = `${randomUUID()}.${ext}`;
    const objectPath = `medical-letters/${filename}`;

    const { error: upErr } = await supabase.storage.from("medical-letters").upload(objectPath, bytes, {
      contentType: mime,
      upsert: false,
    });
    if (upErr) return NextResponse.json({ ok: false, message: `アップロード失敗: ${upErr.message}` }, { status: 500 });

    const { data, error } = await supabase
      .from("reservations")
      .insert({
        guardian_name,
        guardian_phone,
        child_name,
        child_birthdate,
        preferred_date,
        dropoff_time,
        medical_letter_path: objectPath,
        medical_letter_mime: mime,
      })
      .select("id, status")
      .single();

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: data.id, status: data.status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? "server error" }, { status: 500 });
  }
}
