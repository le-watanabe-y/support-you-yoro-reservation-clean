// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 初回アクセス時にだけ生成（ビルド時の env 未設定で落ちないように）。
 * 互換のため：
 *  - default export: getSupabaseAdmin() 関数
 *  - named export : supabaseAdmin（既存の { supabaseAdmin } import を維持）
 */
let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;

  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    "";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ??
    "";

  if (!url) throw new Error("SUPABASE_URL is required.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { "x-application-name": "support-reservation" } },
  });
  return _client;
}

/** 互換用（既存の `{ supabaseAdmin }` import がそのまま動く） */
export const supabaseAdmin: SupabaseClient = getSupabaseAdmin();

/** 推奨： `const s = getSupabaseAdmin();` で利用 */
export default getSupabaseAdmin;
