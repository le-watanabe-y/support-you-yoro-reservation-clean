// app/api/reservations/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClosedDate, withinBookingWindow, toPeriodFromTime } from "@/lib/reservationRules";
import { sendReservationEmails } from "@/lib/mailer";

function nowJST(): Date { return new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Tokyo"})); }
function ymd(d: Date){ const y=d.getFullYear(); const m=String(d.getMonth()+1).padStart(2,"0"); const dd=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${dd}`; }
function addDays(d: Date, n: number){ const c=new Date(d); c.setDate(c.getDate()+n); return c; }
function isTimeHHMM(v: string){ return /^\d{2}:\d{2}$/.test(v); }

export async function GET() {
  const s = supabaseAdmin;
  const { data, error } = await s.from("reservations").select("*").order("created_at",{ascending:false});
  if (error) return NextResponse.json({ ok:false, message:error.message }, { status:500 });
  return NextResponse.json({ ok:true, items:data ?? [] });
}

export async function POST(req: NextRequest) {
  let body:any; try { body = await req.json(); } catch { return NextResponse.json({ ok:false, message:"invalid json" }, { status:400 }); }
  const guardianName = String(body?.guardianName || body?.guardian_name || "").trim();
  const email = String(body?.email || "").trim();
  const childName = body?.childName ?? body?.child_name ?? null;
  const childBirthdate = body?.childBirthdate ?? body?.child_birthdate ?? null;
  const preferredDate = String(body?.preferredDate || body?.preferred_date || "").trim();
  const dropoffTime = String(body?.dropoffTime || body?.dropoff_time || "").trim();

  if (!guardianName || !email || !preferredDate || !dropoffTime)
    return NextResponse.json({ ok:false, message:"必須項目が不足しています" }, { status:400 });
  if (!isTimeHHMM(dropoffTime))
    return NextResponse.json({ ok:false, message:"時刻の形式が不正です（HH:MM）" }, { status:400 });

  const now = nowJST(); const today = ymd(now); const tomorrow = ymd(addDays(now,1));
  const shouldBe = now.getHours() < 12 ? today : tomorrow;
  if (preferredDate !== shouldBe)
    return NextResponse.json({ ok:false, message:"現在はこの日の予約受付時間外です（正午ルール）" }, { status:400 });

  if (isClosedDate(preferredDate))
    return NextResponse.json({ ok:false, message:"休園日のためご予約できません" }, { status:400 });
  if (!withinBookingWindow(preferredDate))
    return NextResponse.json({ ok:false, message:"現在は受付時間外です" }, { status:400 });

  const DAILY_LIMIT = 6;
  const AUTO_APPROVE_FIRST = 2;
  const COUNT_STATUSES = ["pending","approved"] as const;

  const s = supabaseAdmin;
  const { count: dailyCount, error: cntErr } = await s
    .from("reservations")
    .select("id", { count:"exact", head:true })
    .eq("preferred_date", preferredDate)
    .in("status", COUNT_STATUSES as unknown as string[]);
  if (cntErr) return NextResponse.json({ ok:false, message:cntErr.message }, { status:500 });
  if ((dailyCount ?? 0) >= DAILY_LIMIT)
    return NextResponse.json({ ok:false, message:"本日は満員です" }, { status:409 });

  const status: "approved" | "pending" = (dailyCount ?? 0) < AUTO_APPROVE_FIRST ? "approved" : "pending";
  const time_slot = toPeriodFromTime(dropoffTime);

  const insertRow = {
    guardian_name: guardianName, email,
    child_name: childName, child_birthdate: childBirthdate,
    preferred_date: preferredDate, dropoff_time: dropoffTime,
    time_slot, status,
  };

  const { data, error } = await s.from("reservations").insert(insertRow).select().single();
  if (error) {
    if ((error as any).code === "23505")
      return NextResponse.json({ ok:false, message:"同じお子さまの同日予約が既に登録されています" }, { status:409 });
    return NextResponse.json({ ok:false, message:error.message }, { status:500 });
  }

  try {
    await sendReservationEmails({
      id: data?.id,
      guardian_name: data.guardian_name, email: data.email,
      child_name: data.child_name, child_birthdate: data.child_birthdate,
      preferred_date: data.preferred_date, dropoff_time: data.dropoff_time, status: data.status,
    });
  } catch (e) { console.error("sendReservationEmails failed:", e); }

  return NextResponse.json({ ok:true, id:data?.id, status });
}
