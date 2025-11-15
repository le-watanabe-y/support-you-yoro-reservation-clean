// app/api/reservations/route.ts
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isClosedDate, withinBookingWindow, toPeriodFromTime } from "@/lib/reservationRules";

// ---- ユーティリティ ----
function nowJST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function isTimeHHMM(v: string): boolean {
  return /^\d{2}:\d{2}$/.test(v);
}

// ---- GET: 一覧（既存挙動） ----
export async function GET() {
  const s = supabaseAdmin;
  const { data, error } = await s
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, items: data ?? [] });
}

// ---- POST: 予約登録（本実装） ----
export async function POST(req: NextRequest) {
  // ① 入力パース & バリデーション
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "invalid json" }, { status: 400 });
  }

  const guardianName = String(body?.guardianName || "").trim();
  const email = String(body?.email || "").trim();
  const childName = body?.childName ? String(body.childName).trim() : null;
  const childBirthdate = body?.childBirthdate ? String(body.childBirthdate).trim() : null; // "YYYY-MM-DD" or null
  const preferredDate = String(body?.preferredDate || "").trim(); // "YYYY-MM-DD"
  const dropoffTime = String(body?.dropoffTime || "").trim();     // "HH:MM"

  if (!guardianName || !email || !preferredDate || !dropoffTime) {
    return NextResponse.json({ ok: false, message: "必須項目が不足しています" }, { status: 400 });
  }
  if (!isTimeHHMM(dropoffTime)) {
    return NextResponse.json({ ok: false, message: "時刻の形式が不正です（HH:MM）" }, { status: 400 });
  }

  // ② 正午ルールの受付対象日チェック（JST）
  const now = nowJST();
  const today = ymd(now);
  const tomorrow = ymd(addDays(now, 1));
  const hour = now.getHours();
  const shouldBe = hour < 12 ? today : tomorrow; // 00:00–11:59 → 本日 / 12:00–24:00 → 翌日
  if (preferredDate !== shouldBe) {
    return NextResponse.json(
      { ok: false, message: "現在はこの日の予約受付時間外です（正午ルール）" },
      { status: 400 }
    );
  }

  // ③ 休園日・受付ウィンドウ（D-1 12:00 ～ D 12:00）チェック
  if (isClosedDate(preferredDate)) {
    return NextResponse.json({ ok: false, message: "休園日のためご予約できません" }, { status: 400 });
  }
  if (!withinBookingWindow(preferredDate)) {
    return NextResponse.json({ ok: false, message: "現在は受付時間外です" }, { status: 400 });
  }

  // ④ 定員状況（当日合算）を確認
  const DAILY_LIMIT = 6;          // 1日の上限
  const AUTO_APPROVE_FIRST = 2;   // 先着2名は自動承認
  const COUNT_STATUSES = ["pending", "approved"] as const;

  const s = supabaseAdmin;

  const { count: dailyCount, error: countErr } = await s
    .from("reservations")
    .select("id", { count: "exact", head: true })
    .eq("preferred_date", preferredDate)
    .in("status", COUNT_STATUSES as unknown as string[]);

  if (countErr) {
    return NextResponse.json({ ok: false, message: countErr.message }, { status: 500 });
  }
  if ((dailyCount ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ ok: false, message: "本日は満員です" }, { status: 409 });
  }

  // ⑤ 自動承認 or 待機（pending）
  const status: "approved" | "pending" = (dailyCount ?? 0) < AUTO_APPROVE_FIRST ? "approved" : "pending";
  const time_slot = toPeriodFromTime(dropoffTime); // "am" | "pm"

  // ⑥ 登録（同日・同児童の重複はDBユニーク制約で弾かれる）
  const insertRow = {
    guardian_name: guardianName,
    email,
    child_name: childName,
    child_birthdate: childBirthdate, // date列。文字列 "YYYY-MM-DD" をそのまま渡してOK
    preferred_date: preferredDate,
    dropoff_time: dropoffTime,
    time_slot,
    status,
  };

  const { data, error } = await s.from("reservations").insert(insertRow).select().single();

  if (error) {
    // 一意制約違反（既に同一お子さまで同日の予約がある）
    if ((error as any).code === "23505") {
      return NextResponse.json({ ok: false, message: "同じお子さまの同日予約が既に登録されています" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id, status });
}
