// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 環境変数は NEXT_PUBLIC_ とサーバ用の両方に対応。
 * インポート時に落ちないよう、lazy 生成にしてあります。
 */
let cached: SupabaseClient | null = null;

function buildClient(): SupabaseClient {
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

  return createClient(url, serviceKey, {
    auth: { persistSession: false },
    global: { headers: { "x-application-name": "support-reservation" } },
  });
}

/** 現在推奨：関数として取得（lazy & singleton） */
export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = buildClient();
  return cached;
}

/** 互換用：過去コードの { supabaseAdmin } 呼び出しに対応（関数として提供） */
export function supabaseAdmin(): SupabaseClient {
  return getSupabaseAdmin();
}

/** 互換用：default import でも使えるように */
export default supabaseAdmin;
