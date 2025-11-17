import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { data, error } = await supabase
    .from("reservations")
    .select("medical_letter_path, medical_letter_mime")
    .eq("id", params.id)
    .single();

  if (error || !data?.medical_letter_path) return NextResponse.json({ ok: false }, { status: 404 });

  const { data: urlData, error: urlErr } = await supabase.storage
    .from("medical-letters")
    .createSignedUrl(data.medical_letter_path, 60); // 60秒

  if (urlErr || !urlData?.signedUrl) return NextResponse.json({ ok: false }, { status: 500 });

  return NextResponse.json({ ok: true, url: urlData.signedUrl, mime: data.medical_letter_mime });
}
