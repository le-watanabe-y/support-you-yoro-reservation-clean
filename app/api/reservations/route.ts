// app/api/reservations/route.ts
import { NextResponse } from "next/server";

type Reservation = {
  id: number;
  guardianName: string;
  email: string;
  preferredDate: string; // YYYY-MM-DD
  notes?: string;
};

// デプロイをまたぐと消えます（最小サンプル用）
let store: Reservation[] = [];

export async function GET() {
  return NextResponse.json({ ok: true, items: store });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<Reservation>;

    if (!body.guardianName || !body.email || !body.preferredDate) {
      return NextResponse.json(
        { ok: false, message: "必須項目が足りません" },
        { status: 400 }
      );
    }

    const id = store.length ? Math.max(...store.map((x) => x.id)) + 1 : 1;
    const rec: Reservation = {
      id,
      guardianName: body.guardianName,
      email: body.email,
      preferredDate: body.preferredDate,
      notes: body.notes ?? "",
    };

    store.push(rec);
    // フォーム側が参照する id を返す
    return NextResponse.json({ ok: true, id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "invalid json" },
      { status: 400 }
    );
  }
}
