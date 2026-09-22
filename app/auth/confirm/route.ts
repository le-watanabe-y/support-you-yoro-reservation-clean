// Landing page for links in Supabase Auth emails (sign-up confirmation, password reset).
// The email templates must point here with token_hash and type (see README).
import { NextResponse } from 'next/server';
import { getBackend } from '@/lib/server/backend.mjs';
import { confirmLink } from '@/lib/server/confirm.mjs';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { location, cookies } = await confirmLink(request, getBackend());
  const response = NextResponse.redirect(new URL(location, request.url), 303);
  for (const cookie of cookies) response.headers.append('Set-Cookie', cookie);
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
