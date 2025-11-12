import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const { name, phone, date, time, notes } = await req.json();

    if (!name || !phone || !date || !time) {
      return new Response(JSON.stringify({ error: "必須項目が未入力です" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const supabaseUrl = process.env.SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // サーバー専用鍵（クライアントに出ません）
    const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

    const { error } = await supabase.from("reservations").insert({
      name,
      phone,
      date,
      time,
      notes: notes ?? "",
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "不正なリクエスト" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
}
