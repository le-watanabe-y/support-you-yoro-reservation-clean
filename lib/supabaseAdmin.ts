// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase Admin クライアントを 1 箇所で生成し、
 * - named export   : supabaseAdmin
 * - default export : supabaseAdmin
 * - function       : getSupabaseAdmin()
 * の3通りを同時に提供して互換性を確保する。
 */

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  throw new Error("SUPABASE_URL 環境変数が未設定です。Vercel の Project Settings → Environment Variables を確認してください。");
}
if (!serviceKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY 環境変数が未設定です。Vercel の Project Settings → Environment Variables を確認してください。");
}

const client: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "support-reservation" } },
});

/** 旧来コード用（named import） */
export const supabaseAdmin = client;
/** 旧来コード用（default import） */
export default client;
/** 関数として取得したいコード用（getSupabaseAdmin()） */
export function getSupabaseAdmin() {
  return client;
}
