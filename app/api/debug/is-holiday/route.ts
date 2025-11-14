// app/api/debug/is-holiday/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { isJapanHoliday, jpHolidayInfo } from '@/lib/jpHolidays';
import { parseYmd } from '@/lib/reservationRules';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date') || new Date().toISOString().slice(0, 10);
  const dateUtc = parseYmd(dateStr);

  return NextResponse.json({
    ok: true,
    date: dateStr,
    holiday: isJapanHoliday(dateUtc),
    info: jpHolidayInfo(dateUtc),
  });
}
