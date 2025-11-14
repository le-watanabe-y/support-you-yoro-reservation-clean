// app/api/debug/is-holiday/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isJpHoliday, jpHolidayInfo } from "@/lib/jpHolidays";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  if (!date) {
    return NextResponse.json({ ok: false, message: "date is required" }, { status: 400 });
  }
  const info = jpHolidayInfo(date);
  return NextResponse.json({
    ok: true,
    date,
    isHoliday: isJpHoliday(date),
    info: info ?? [],
  });
}
