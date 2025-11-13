// app/api/reservations/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const items = [
    { id: 1, name: "山田太郎", date: "2025-11-15", time: "10:00" },
    { id: 2, name: "佐藤花子", date: "2025-11-16", time: "14:00" }
  ];
  return NextResponse.json({ ok: true, items });
}
