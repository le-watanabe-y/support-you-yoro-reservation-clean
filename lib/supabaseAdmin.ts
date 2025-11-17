// lib/supabaseAdmin.ts
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) throw new Error("SUPABASE_URL is required");
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");

// ← 定数として作る（関数ではない）
export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "support-reservation" } },
});

// 互換用：古いコードがあっても拾えるように
export function getSupabaseAdmin() {
  return supabaseAdmin;
}

// 互換用：default import でも動くように
export default supabaseAdmin;
