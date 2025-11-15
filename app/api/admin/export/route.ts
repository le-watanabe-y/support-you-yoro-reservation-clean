import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { okAuth } from "@/lib/config"; // 認証ユーティリティを使っている前提（なければ削除）

function unauthorized() {
  return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
}

export async function GET(req: NextRequest) {
  // Basic 認証などを通過させたい場合はここで判定
  if (typeof okAuth === "function" && !okAuth(req)) return unauthorized();

  // supabaseAdmin は「関数ではありません」。そのまま使います。
  const s = supabaseAdmin;

  const { data, error } = await s
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  // CSV にしたい場合は必要な列だけ整形してください。まずは JSON 返却。
  return NextResponse.json({ ok: true, items: data ?? [] });
}
