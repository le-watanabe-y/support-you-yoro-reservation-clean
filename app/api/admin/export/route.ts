// app/api/admin/export/route.ts  （全置き換え）
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

function unauthorized() {
  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}

function okAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;
  try {
    const [, b64] = auth.split(" ");
    const decoded = Buffer.from(b64, "base64").toString();
    const [user, pass] = decoded.split(":");
    return user === process.env.ADMIN_USER && pass === process.env.ADMIN_PASS;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!okAuth(req)) return unauthorized();

  const s = supabaseAdmin();
  const { data, error } = await s
    .from("reservations")
    .select(
      "id,created_at,preferred_date,dropoff_time,time_slot,status,guardian_name,email,child_name,child_birthdate,notes"
    )
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const rows = data ?? [];
  const header = [
    "id","created_at","preferred_date","dropoff_time","time_slot","status",
    "guardian_name","email","child_name","child_birthdate","notes"
  ];
  const escape = (v: any) => {
    const s = v == null ? "" : String(v).replace(/"/g, '""');
    return `"${s}"`;
    };
  const csv = [header.join(","), ...rows.map(r => header.map(h => escape((r as any)[h])).join(","))].join("\n");

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reservations.csv"`,
    },
  });
}
