import { after } from 'next/server';
import { handleApi } from '@/lib/server/api.mjs';
import { getBackend } from '@/lib/server/backend.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Vercel: allow slower Supabase round trips during document uploads.
export const maxDuration = 30;

type Context = { params: Promise<{ role: string; action: string }> };

async function run(request: Request, context: Context) {
  const { role, action } = await context.params;
  return handleApi(request, { role, action, backend: getBackend(), defer: task => after(task) });
}

export const GET = run;
export const POST = run;
