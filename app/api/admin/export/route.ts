// app/api/admin/export/route.ts（全置き換え）
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { okAuth } from "@/lib/config";

function toCsv(rows: any[]): string {
  const headers = [
    "id","created_at","status","guardian_name","email","guardian_phone",
    "child_name","child_birthdate","preferred_date","dropoff_time","time_slot","notes",
  ];
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => esc(r?.[h])).join(","))];
  return lines.join("\n");
}

export async function GET(req: Request) {
  if (!okAuth(req)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "json";

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (format === "csv") {
    const csv = toCsv(data ?? []);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reservations.csv"`,
      },
    });
  }

  return NextResponse.json({ ok: true, items: data ?? [] });
}
