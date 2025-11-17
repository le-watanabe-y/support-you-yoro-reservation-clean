// lib/supabaseAdmin.ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { "x-application-name": "support-reservation" } },
});

// 呼び出し側が () で使いたい場合のために関数も用意
export const getSupabaseAdmin = (): SupabaseClient => supabaseAdmin;

// named / default のどちらでも import できるようにしておく
export default supabaseAdmin;
