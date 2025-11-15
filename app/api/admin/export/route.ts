// app/api/admin/export/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

function basicAuthOK(req: NextRequest): boolean {
  const h = req.headers.get("authorization") ?? "";
  if (!h.startsWith("Basic ")) return false;
  const [user, pass] = Buffer.from(h.slice(6), "base64").toString("utf8").split(":");
  return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
}
function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

export async function GET(req: NextRequest) {
  if (!basicAuthOK(req)) return unauthorized();

  const s = supabaseAdmin;
  const { data, error } = await s
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const headers = [
    "id","guardian_name","email","preferred_date","dropoff_time",
    "time_slot","status","child_name","child_birthdate","created_at"
  ];
  const esc = (v: any) =>
    `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv =
    [headers.join(",")]
      .concat(
        (data ?? []).map(r =>
          [
            r.id, r.guardian_name, r.email, r.preferred_date, r.dropoff_time,
            r.time_slot, r.status, r.child_name, r.child_birthdate, r.created_at
          ].map(esc).join(",")
        )
      )
      .join("\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reservations.csv"',
    },
  });
}
