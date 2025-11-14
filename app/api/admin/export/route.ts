// app/api/admin/export/route.ts
import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status"); // "pending" | "approved" | "rejected" | "cancelled" | "all"

  let query = supabaseAdmin
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (status && status !== "all") query = query.eq("status", status);
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) {
    return new Response(JSON.stringify({ ok: false, message: error.message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }

  const headers = [
    "id",
    "created_at",
    "guardian_name",
    "email",
    "guardian_phone",
    "child_name",
    "child_birthdate",
    "child_allergy",
    "date",
    "period",
    "status",
    "notes",
    "note",
  ];

  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return /[",\n]/.test(s) ? `"${s}"` : s;
    // 改行やカンマを含む場合はダブルクォートで囲む
  };

  const csv = [headers.join(",")]
    .concat((data ?? []).map((row: any) => headers.map((h) => esc(row[h])).join(",")))
    .join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": 'attachment; filename="reservations.csv"',
      "cache-control": "no-store",
    },
  });
}
