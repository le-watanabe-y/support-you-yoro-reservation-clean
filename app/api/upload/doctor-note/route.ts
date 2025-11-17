// app/api/upload/doctor-note/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOW = ["image/jpeg", "image/png", "application/pdf"];

function extFrom(filename: string, mime: string): string {
  const byName = filename.split(".").pop()?.toLowerCase();
  if (byName) return byName;
  if (mime === "application/pdf") return "pdf";
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  return "bin";
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ ok: false, message: "file is required" }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ ok: false, message: "10MBまで" }, { status: 413 });
    if (!ALLOW.includes(file.type)) {
      return NextResponse.json({ ok: false, message: "PDF / JPG / PNG のみ可" }, { status: 400 });
    }

    const y = new Date().getUTCFullYear();
    const m = String(new Date().getUTCMonth() + 1).padStart(2, "0");
    const id = randomUUID();
    const ext = extFrom((file as any).name ?? "", file.type);
    const path = `${y}/${m}/${id}.${ext}`;

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    const s = supabaseAdmin();
    const { error } = await s.storage
      .from("doctor-notes")
      .upload(path, buf, { contentType: file.type, upsert: false });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      path,
      mime: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? String(e) }, { status: 500 });
  }
}
