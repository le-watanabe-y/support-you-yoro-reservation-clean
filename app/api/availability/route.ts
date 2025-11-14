// app/api/availability/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  LIMITS,
  parseYmd,
  canAcceptForDate,
  limitFor,
  TimeSlot,
  slotFromTimeStr,
} from "@/lib/reservationRules";

function isCountStatus(s: string | null): boolean {
  return (LIMITS.countStatuses as readonly string[]).includes(String(s));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ymd = searchParams.get("date");
  const time = searchParams.get("time"); // "HH:mm"（ある場合は優先）
  const slotParam = searchParams.get("slot") as TimeSlot | null;
  const slot: TimeSlot = time ? slotFromTimeStr(time) : (slotParam ?? "am");

  if (!ymd) {
    return NextResponse.json({ ok: false, message: "date を指定してください" }, { status: 400 });
  }
  const d = parseYmd(ymd);
  if (!d) return NextResponse.json({ ok: false, message: "日付形式が不正です" }, { status: 400 });

  const win = canAcceptForDate(d);
  if (!win.ok) {
    return NextResponse.json({ ok: true, canReserve: false, reason: win.reason, slot, time });
  }

  const { data, error } = await supabaseAdmin
    .from("reservations")
    .select("id,status,time_slot")
    .eq("preferred_date", ymd);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });

  const target = (data ?? []).filter((r: any) => isCountStatus(r.status));
  const dayCount = target.length;
  const slotCount = target.filter((r: any) => r.time_slot === slot).length;

  const canReserve = dayCount < LIMITS.day && slotCount < limitFor(slot);

  return NextResponse.json({
    ok: true,
    date: ymd,
    time,
    slot,
    canReserve,
    counts: { day: dayCount, slot: slotCount, limits: { day: LIMITS.day, [slot]: limitFor(slot) } },
  });
}
