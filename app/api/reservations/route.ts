// app/api/reservations/route.ts
import { NextResponse } from "next/server";

type Payload = {
  guardianName: string;
  email: string;
  preferredDate: string; // YYYY-MM-DD
  notes?: string;
};

type Item = Payload & { id: string; createdAt: string };

export const dynamic = "force-dynamic"; // 常に最新

// デモ用のメモリ保存（永続化なし）
const mem: Item[] = [];

export async function GET() {
  return NextResponse.json({ ok: true, items: mem });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Payload;
    if (!body.guardianName || !body.email || !body.preferredDate) {
      return NextResponse.json(
        { ok: false, message: "必須項目（名前/メール/希望日）が足りません" },
        { status: 400 }
      );
    }
    const item: Item = {
      id: crypto.randomUUID(),
      ...body,
      createdAt: new Date().toISOString(),
    };
    mem.push(item);
    return NextResponse.json({ ok: true, id: item.id, item }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, message: "JSONの解釈に失敗しました" },
      { status: 400 }
    );
  }
}
