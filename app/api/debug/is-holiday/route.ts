// app/api/debug/is-holiday/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isJapanHoliday, japanHolidayName } from "@/lib/holidayJP";
import { normalizeDate } from "@/lib/reservationRules";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date") ?? "";
  const date = normalizeDate(dateParam);
  if (!date) return NextResponse.json({ ok: false, message: "date=YYYY-MM-DD を指定してください" }, { status: 400 });

  const isHoliday = isJapanHoliday(date);
  return NextResponse.json({ ok: true, date, holiday: isHoliday, name: japanHolidayName(date) });
}
