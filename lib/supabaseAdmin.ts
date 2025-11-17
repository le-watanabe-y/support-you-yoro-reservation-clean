// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "support-reservation" } },
});

// () で呼びたい派のためのラッパー関数（どちらでも可）
export const getSupabaseAdmin = (): SupabaseClient => supabaseAdmin;

// named / default どちらでも import 可能に
export default supabaseAdmin;
