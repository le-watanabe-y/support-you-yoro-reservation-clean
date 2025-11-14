// app/api/debug/is-holiday/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isJpHoliday, jpHolidayInfo } from "@/lib/jpholiday";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date") || "";

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ ok: false, message: "date must be YYYY-MM-DD" }, { status: 400 });
  }

  const isHoliday = isJpHoliday(date);
  const info = jpHolidayInfo(date);

  return NextResponse.json({ ok: true, date, isHoliday, name: info?.name ?? null });
}
