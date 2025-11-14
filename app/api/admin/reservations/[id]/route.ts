// app/api/admin/reservations/[id]/route.ts  （全置き換え）
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

function periodFromTime(hhmm: string): "am" | "pm" {
  const hh = Number((hhmm || "00:00").split(":")[0] || 0);
  return hh < 12 ? "am" : "pm";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!okAuth(req)) return unauthorized();

  const id = params.id;
  const body = await req.json().catch(() => ({} as any));

  const updates: Record<string, any> = {};
  if (
    typeof body.status === "string" &&
    ["pending", "approved", "rejected", "canceled"].includes(body.status)
  ) {
    updates.status = body.status;
  }
  if (typeof body.dropoff_time === "string") {
    if (!/^\d{2}:\d{2}$/.test(body.dropoff_time)) {
      return NextResponse.json(
        { ok: false, message: "dropoff_time は HH:MM で指定してください" },
        { status: 400 }
      );
    }
    updates.dropoff_time = body.dropoff_time;
    updates.time_slot = periodFromTime(body.dropoff_time);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, message: "更新対象がありません" }, { status: 400 });
  }

  const s = supabaseAdmin();
  const { error } = await s.from("reservations").update(updates).eq("id", id);
  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
