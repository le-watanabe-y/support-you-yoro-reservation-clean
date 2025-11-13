import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "support-reservation" } },
});

// 使う/使わないは自由（型が欲しいとき用）
export type ReservationRow = {
  id: string;
  guardian_name: string;
  email: string;
  preferred_date: string; // YYYY-MM-DD
  notes: string | null;
  created_at: string;
};
