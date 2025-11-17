import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const v = process.env;
  return NextResponse.json({
    SUPABASE_URL: Boolean(v.SUPABASE_URL || v.NEXT_PUBLIC_SUPABASE_URL),
    SUPABASE_SERVICE_ROLE_KEY: Boolean(v.SUPABASE_SERVICE_ROLE_KEY || v.SUPABASE_SERVICE_KEY),
    NODE_ENV: v.NODE_ENV ?? null,
  });
}
