// app/api/debug/is-holiday/route.ts
import { NextRequest, NextResponse } from "next/server";
import { isJapaneseHoliday, jpHolidayInfo } from "@/lib/jpholiday";

/** /api/debug/is-holiday?date=YYYY-MM-DD */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get("date");
  if (!dateStr) {
    return NextResponse.json(
      { ok: false, error: "Missing date (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  // 判定は UTC 固定で行う
  const isHoliday = isJapaneseHoliday(dateStr);
  const info = jpHolidayInfo(dateStr);

  return NextResponse.json({
    ok: true,
    date: dateStr,
    holiday: isHoliday,
    name: info?.name ?? null,
  });
}
