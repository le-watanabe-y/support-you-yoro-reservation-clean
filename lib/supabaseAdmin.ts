import { createClient } from '@supabase/supabase-js';

export type ReservationRow = {
  id: string;
  guardian_name: string;
  email: string;
  preferred_date: string;
  notes: string | null;
  created_at: string;
};

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
