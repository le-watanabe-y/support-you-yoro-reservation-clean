// app/api/availability/route.ts
import { NextResponse } from "next/server";
import { isClosedDate, withinOpenWindow } from "@/lib/reservationRules";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const date = (searchParams.get("date") || "").slice(0, 10);
  const time = searchParams.get("time") || null; // 将来拡張用

  const closed = isClosedDate(date);
  const within = withinOpenWindow(date);

  return NextResponse.json({
    date,
    closed,
    withinWindow: within,
    canReserve: !closed && within,
  });
}
