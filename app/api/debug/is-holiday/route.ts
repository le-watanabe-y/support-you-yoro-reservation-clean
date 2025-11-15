// app/api/debug/is-holiday/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

function toJSTDate(dateStr: string) {
  // YYYY-MM-DD を JST の 00:00 に
  return new Date(`${dateStr}T00:00:00+09:00`);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ ok: false, message: "date is required" }, { status: 400 });
  }

  try {
    // date-holidays を動的 import（未インストールでも落ちないように try/catch）
    const mod: any = await import("date-holidays");
    const Holidays = mod.default || mod;
    const hd = new Holidays("JP");
    const info = hd.isHoliday(toJSTDate(date));

    let name: string | undefined;
    let holiday = false;
    if (info) {
      holiday = true;
      if (Array.isArray(info)) name = info[0]?.name;
      else name = (info as any).name;
    }
    return NextResponse.json({ ok: true, date, holiday, name });
  } catch {
    // フォールバック：祝日判定できない場合は false を返す
    return NextResponse.json({ ok: true, date, holiday: false });
  }
}
