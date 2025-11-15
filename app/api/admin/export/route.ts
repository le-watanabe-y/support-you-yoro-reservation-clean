// app/api/admin/export/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { okAuth } from "@/lib/adminAuth";

function csvEscape(v: any): string {
  const s = v == null ? "" : String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(req: NextRequest) {
  if (!okAuth(req)) {
    return NextResponse.json({ ok: false, message: "unauthorized" }, { status: 401, headers: { "WWW-Authenticate": 'Basic realm="admin"' } });
  }

  const s = supabaseAdmin;
  const { data, error } = await s
    .from("reservations")
    .select("id, preferred_date, dropoff_time, time_slot, guardian_name, email, child_name, child_birthdate, status, created_at")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const header = ["id","preferred_date","dropoff_time","time_slot","guardian_name","email","child_name","child_birthdate","status","created_at"];
  const lines = [header.join(",")];
  for (const r of data ?? []) {
    lines.push(header.map((h) => csvEscape((r as any)[h])).join(","));
  }
  const csv = lines.join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=UTF-8",
      "Content-Disposition": 'attachment; filename="reservations.csv"',
    },
  });
}
