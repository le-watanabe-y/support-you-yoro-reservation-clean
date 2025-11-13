import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type ReservationRow = {
  id: string;
  guardian_name: string;
  email: string;
  preferred_date: string;
  notes: string | null;
  created_at: string;
};

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

export const supabaseAdmin: SupabaseClient = createClient(url, serviceKey, {
  auth: { persistSession: false },
  global: { headers: { 'x-application-name': 'support-reservation' } }
});
