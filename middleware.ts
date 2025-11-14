// middleware.ts
import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};

export function middleware(req: NextRequest) {
  const USER = process.env.ADMIN_USER;
  const PASS = process.env.ADMIN_PASS;
  if (!USER || !PASS) return NextResponse.next(); // 未設定なら通す（開発用）

  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Basic ")) {
    return new NextResponse("Auth required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  const b64 = auth.split(" ")[1] ?? "";
  let u = "", p = "";
  try {
    const decoded = atob(b64);
    const i = decoded.indexOf(":");
    u = decoded.slice(0, i);
    p = decoded.slice(i + 1);
  } catch {
    // 失敗時は 401
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  if (u === USER && p === PASS) return NextResponse.next();

  return new NextResponse("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="admin"' },
  });
}
