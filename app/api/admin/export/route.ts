import { supabaseAdmin } from '@/lib/supabase-admin';

function escapeCsv(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('reservations')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return new Response(`error,${escapeCsv(error.message)}`, { status: 500 });
  }

  const headers = ['id', 'guardian_name', 'email', 'preferred_date', 'notes', 'created_at'];
  const rows = (data ?? []).map((r: any) => headers.map((h) => escapeCsv(r[h])).join(','));
  const csv = [headers.join(','), ...rows].join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="reservations.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
