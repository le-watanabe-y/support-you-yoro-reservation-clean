// app/api/reservations/route.ts
import { NextResponse } from "next/server";

// メモリ保存（デプロイごとにリセットされる簡易版）
type Payload = {
  guardianName: string;
  email: string;
  preferredDate: string;
  notes?: string;
};
const mem: Array<Payload & { id: string; createdAt: string }> = [];

export async function GET() {
  return NextResponse.json({ ok: true, items: mem });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;

    // 必須チェック
    if (!body.guardianName || !body.email || !body.preferredDate) {
      return NextResponse.json(
        { ok: false, message: "必須項目（名前/メール/希望日）が足りません" },
        { status: 400 }
      );
    }

    // 登録（id は簡易に現在時刻＋配列長）
    const item = {
      id: `${Date.now()}-${mem.length + 1}`,
      ...body,
      createdAt: new Date().toISOString(),
    };
    mem.push(item);

    return NextResponse.json({ ok: true, id: item.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, message: e?.message ?? "エラーが発生しました" },
      { status: 500 }
    );
  }
}
