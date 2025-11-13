import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// public.reservations の行型（必要に応じて調整）
export type ReservationRow = {
  id: string;                 // uuid
  guardian_name: string;
  email: string;
  preferred_date: string;     // 'YYYY-MM-DD'
  notes: string | null;
  created_at: string;         // ISO timestamp
};

const url = process.env.SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin: SupabaseClient = createClient(url, serviceRoleKey, {
  auth: { persistSession: false },
  global: { headers: { 'x-application-name': 'support-reservation' } },
});
