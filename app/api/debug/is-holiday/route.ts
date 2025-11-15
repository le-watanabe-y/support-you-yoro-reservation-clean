// app/api/debug/is-holiday/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import Holidays from "date-holidays";

/**
 * GET /api/debug/is-holiday?date=YYYY-MM-DD
 * -> { ok:true, date, holiday:true/false, info:{ name } | null }
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return NextResponse.json(
      { ok: false, message: 'query "date=YYYY-MM-DD" is required' },
      { status: 400 }
    );
  }

  const hd = new Holidays("JP");
  // JST基準で祝日判定
  const h = hd.isHoliday(new Date(`${date}T00:00:00+09:00`));
  const holiday = !!h;
  const info =
    holiday
      ? { name: Array.isArray(h) ? (h[0] as any)?.name ?? "祝日" : (h as any)?.name ?? "祝日" }
      : null;

  return NextResponse.json({ ok: true, date, holiday, info });
}
