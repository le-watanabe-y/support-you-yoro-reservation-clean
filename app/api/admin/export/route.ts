// app/api/admin/export/route.ts
// Node.js ランタイムで動かします（Buffer を使うため）
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin"; // ← “関数” ではなく “クライアント” を import

// ----- Basic 認証（Vercel 環境変数: ADMIN_USER / ADMIN_PASS） -----
function basicAuthOK(req: NextRequest): boolean {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Basic ")) return false;
  const decoded = Buffer.from(h.slice(6), "base64").toString("utf8"); // "user:pass"
  const idx = decoded.indexOf(":");
  if (idx < 0) return false;
  const user = decoded.slice(0, idx);
  const pass = decoded.slice(idx + 1);
  return (
    user === process.env.ADMIN_USER &&
    pass === process.env.ADMIN_PASS &&
    !!user &&
    !!pass
  );
}

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

// CSV 1セルのエスケープ
function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '""';
  const s = String(v).replace(/"/g, '""');
  return `"${s}"`;
}

export async function GET(req: NextRequest) {
  if (!basicAuthOK(req)) return unauthorized();

  const s = supabaseAdmin; // ← 呼び出さない（supabaseAdmin() はダメ）
  const { data, error } = await s
    .from("reservations")
    .select(
      "id,created_at,guardian_name,email,preferred_date,dropoff_time,time_slot,child_name,child_birthdate,status"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const headers = [
    "id",
    "created_at",
    "guardian_name",
    "email",
    "preferred_date",
    "dropoff_time",
    "time_slot",
    "child_name",
    "child_birthdate",
    "status",
  ];

  const rows = (data ?? []).map((r: any) =>
    headers.map((k) => csvCell(r[k])).join(",")
  );
  const csv = [headers.join(","), ...rows].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
