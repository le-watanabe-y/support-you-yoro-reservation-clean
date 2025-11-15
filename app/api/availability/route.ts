// app/api/availability/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import {
  isClosedDate,
  withinBookingWindow,
  toPeriodFromTime,
} from "@/lib/reservationRules";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date"); // YYYY-MM-DD（必須）
  const time = url.searchParams.get("time"); // HH:mm（任意）

  if (!date) {
    return NextResponse.json(
      { ok: false, message: 'query "date=YYYY-MM-DD" is required' },
      { status: 400 }
    );
  }

  const closed = isClosedDate(date);
  const within = withinBookingWindow(date);
  const period = toPeriodFromTime(time);
  const canReserve = !closed && within;

  return NextResponse.json({
    ok: true,
    date,
    time,
    period,                      // 'am' | 'pm'（内部参照用）
    closed,                      // 休園日/土日祝/年末年始
    withinBookingWindow: within, // ウィンドウ内か
    canReserve,                  // 最終的な受付可否
  });
}
