import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// ここに一致するパスを保護します
const PROTECTED = ['/admin', '/api/reservations', '/api/admin'];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 対象パスかを判定
  const needAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needAuth) return NextResponse.next();

  const user = process.env.ADMIN_USER;
  const pass = process.env.ADMIN_PASS;
  // 環境変数未設定なら何もしない（必ず設定してください）
  if (!user || !pass) return NextResponse.next();

  const auth = req.headers.get('authorization') || '';
  if (!auth.startsWith('Basic ')) {
    return new NextResponse('Auth required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
    });
  }

  const [, base64] = auth.split(' ');
  const [u, p] = Buffer.from(base64, 'base64').toString().split(':');

  if (u === user && p === pass) return NextResponse.next();

  return new NextResponse('Unauthorized', {
    status: 401,
    headers: { 'WWW-Authenticate': 'Basic realm="Secure Area"' },
  });
}

export const config = {
  matcher: ['/admin/:path*', '/api/reservations', '/api/admin/:path*'],
};
