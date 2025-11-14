import { NextRequest, NextResponse } from "next/server";
import {
  isClosedDate,
  withinBookingWindow,
  toPeriodFromTime,
} from "@/lib/reservationRules";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").trim();
  const time = (searchParams.get("time") || "").trim();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { ok: false, message: "date must be YYYY-MM-DD" },
      { status: 400 }
    );
  }
  const closed = isClosedDate(date);
  const within = withinBookingWindow(date);

  let timeSlot: "am" | "pm" | null = null;
  if (/^([01]?\d|2[0-3]):([0-5]\d)$/.test(time)) {
    timeSlot = toPeriodFromTime(time);
  }

  return NextResponse.json({
    ok: true,
    date,
    time: time || null,
    timeSlot,
    closed,
    withinBookingWindow: within,
    canReserve: within && !closed,
  });
}
