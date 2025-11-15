import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/** ---- Basic 認証（環境変数 ADMIN_USER / ADMIN_PASS） ---- */
function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}
function okAuth(req: NextRequest) {
  const h = req.headers.get("authorization") || "";
  if (!h.startsWith("Basic ")) return false;
  const [user, pass] = Buffer.from(h.slice(6), "base64").toString().split(":");
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}

/** ---- CSV 生成 ---- */
function esc(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(rows: any[]): string {
  const cols = [
    "id",
    "preferred_date",
    "dropoff_time",
    "time_slot",
    "guardian_name",
    "child_name",
    "child_birthdate",
    "email",
    "status",
    "created_at",
    "notes",
  ];
  const head = cols.join(",");
  const body = rows.map(r => cols.map(c => esc((r as any)[c])).join(",")).join("\n");
  // Excel 配慮で BOM 付与
  return "\uFEFF" + head + "\n" + body;
}

/** ---- GET /api/admin/export ---- */
export async function GET(req: NextRequest) {
  if (!okAuth(req)) return unauthorized();

  // ★ supabaseAdmin は「関数ではない」ので () を付けない
  const s = supabaseAdmin;

  const { data, error } = await s
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const csv = toCsv(data ?? []);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reservations.csv"',
      "Cache-Control": "no-store",
    },
  });
}
