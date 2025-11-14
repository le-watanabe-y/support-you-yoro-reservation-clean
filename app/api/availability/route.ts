// app/api/availability/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { parseYmd, canAcceptForDate } from '@/lib/reservationRules';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const dateStr = searchParams.get('date');
  if (!dateStr) {
    return NextResponse.json({ ok: false, message: 'query "date" is required (YYYY-MM-DD)' }, { status: 400 });
  }
  const judge = canAcceptForDate(parseYmd(dateStr));
  return NextResponse.json({ ok: true, date: dateStr, ...judge });
}
