import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, items: data ?? [] });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (!body?.guardianName || !body?.email || !body?.preferredDate) {
      return NextResponse.json(
        { ok: false, message: '必須項目（名前/メール/希望日）が足りません' },
        { status: 400 }
      );
    }

    const insert = {
      guardian_name: body.guardianName,
      email: body.email,
      preferred_date: body.preferredDate, // YYYY-MM-DD
      notes: body.notes ?? null,
    };

    const { data, error } = await supabaseAdmin
      .from('reservations')
      .insert(insert)
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, message: e?.message ?? 'サーバーエラー' }, { status: 500 });
  }
}
