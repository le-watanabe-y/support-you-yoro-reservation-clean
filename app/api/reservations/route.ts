import { NextResponse } from "next/server";

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
    if (!body.guardianName || !body.email || !body.preferredDate) {
      return NextResponse.json(
        { ok: false, message: "必須項目（名前/メール/希望日）が足りません" },
        { status: 400 }
      );
    }
    const item = {
      id: crypto.randomUUID(),
      ...body,
      createdAt: new Date().toISOString(),
    };
    mem.push(item);
    return NextResponse.json({ ok: true, id: item.id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, message: "不正なJSONです" },
      { status: 400 }
    );
  }
}
