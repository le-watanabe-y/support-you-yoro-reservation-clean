// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

export type ReservationRow = {
  id: string;                // uuid想定（intでもstringでOK）
  guardian_name: string;
  email: string;
  preferred_date: string;    // YYYY-MM-DD を文字列で
  notes: string | null;
  created_at: string;
};

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// サーバー専用の管理クライアント（セッション保持なし）
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "support-reservation" } },
});
