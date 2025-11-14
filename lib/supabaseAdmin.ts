// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

// サーバー専用（Service Role）。クライアントからは使わせない。
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "support-reservation" } },
});

// 一覧・CSV で型補助に使える行の型（必要に応じ拡張）
export type ReservationRow = {
  id: string;
  created_at: string;
  guardian_name: string | null;
  email: string | null;
  guardian_phone: string | null;
  child_name: string | null;
  child_birthdate: string | null;
  child_allergy: string | null;
  date: string | null;
  period: "am" | "pm" | null;
  status: "pending" | "approved" | "rejected" | "cancelled" | null;
  notes: string | null;
  note: string | null;
};
