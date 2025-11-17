// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 環境変数は NEXT_PUBLIC_ とサーバ用の両方を許容。
 * ここでは「インポート時に throw しない」よう lazy 生成にします。
 */
let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;

  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? // 両対応
    "";

  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_SERVICE_KEY ?? // 念のための互換名
    "";

  if (!url) throw new Error("SUPABASE_URL is required.");
  if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required.");

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { "x-application-name": "support-reservation" } },
  });

  return cached;
}

// 既存コードが default import を使っていても呼べるようにエイリアスを用意
export default getSupabaseAdmin;
