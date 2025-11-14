import { NextRequest, NextResponse } from "next/server";
import { withinBookingWindow, isClosedDate, deriveSlotFromTime, RULES } from "@/lib/reservationRules";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date"); // YYYY-MM-DD
  const time = searchParams.get("time"); // HH:MM（任意）

  if (!date) return NextResponse.json({ ok: false, message: "date is required" }, { status: 400 });

  const closed = isClosedDate(date);
  const within = withinBookingWindow(date);

  let canReserve = false;

  if (!closed && within) {
    const slot = deriveSlotFromTime(time);

    const { data, error } = await supabaseAdmin
      .from("reservations")
      .select("id,status,dropoff_time")
      .eq("preferred_date", date)
      .in("status", RULES.COUNT_STATUSES as any);

    if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

    const total = data.length;
    const dailyLeft = Math.max(RULES.DAILY_LIMIT - total, 0);

    let slotLeft: number | null = null;
    if (slot) {
      const inSlot = data.filter(r => {
        const hhmm = (r as any).dropoff_time as string | null;
        return deriveSlotFromTime(hhmm) === slot;
      }).length;
      const limit = slot === "am" ? RULES.SLOT_LIMIT_AM : RULES.SLOT_LIMIT_PM;
      slotLeft = Math.max(limit - inSlot, 0);
    }

    canReserve = dailyLeft > 0 && (slotLeft === null || slotLeft > 0);
  }

  return NextResponse.json({
    ok: true,
    date,
    time,
    closed,
    withinBookingWindow: within,
    canReserve,
  });
}
