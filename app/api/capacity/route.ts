// app/api/capacity/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const COUNT_STATUSES = ["pending", "approved"] as const;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD

  if (!date) {
    return NextResponse.json({ ok: false, message: "date is required" }, { status: 400 });
  }

  // 1) その日の定員
  const { data: capRow } = await supabaseAdmin
    .from("capacities")
    .select("capacity")
    .eq("day", date)
    .maybeSingle();

  const fallback = Number(process.env.DEFAULT_DAILY_CAPACITY ?? "0");
  const capacity = capRow?.capacity ?? fallback;

  // 2) その日の予約数（pending + approved）
  const { count, error } = await supabaseAdmin
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", date)
    .in("status", COUNT_STATUSES as unknown as string[]);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  const booked = count ?? 0;
  const remaining = Math.max(0, capacity - booked);

  return NextResponse.json({
    ok: true,
    date,
    capacity,
    booked,
    remaining,
    full: remaining <= 0,
  });
}
