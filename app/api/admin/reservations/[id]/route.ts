// app/api/admin/reservations/[id]/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // ← 関数ではなく“クライアント”

// Basic 認証（Vercel環境変数 ADMIN_USER / ADMIN_PASS）
function basicAuthOK(req: NextRequest): boolean {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Basic ")) return false;
  const decoded = Buffer.from(h.slice(6), "base64").toString("utf8"); // "user:pass"
  const i = decoded.indexOf(":");
  if (i < 0) return false;
  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}
function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

const ALLOWED = ["approved", "rejected"] as const;
type Status = (typeof ALLOWED)[number];

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!basicAuthOK(req)) return unauthorized();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }

  const status = body?.status as Status;
  if (!ALLOWED.includes(status)) {
    return NextResponse.json(
      { ok: false, message: 'status must be "approved" or "rejected"' },
      { status: 400 }
    );
  }

  const s = supabaseAdmin; // ← ここは “supabaseAdmin()” と呼ばない
  const { data, error } = await s
    .from("reservations")
    .update({ status })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, item: data });
}
