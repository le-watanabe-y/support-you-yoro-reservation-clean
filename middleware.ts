// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 対象パス
  const needAuth =
    pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if (!needAuth) return NextResponse.next();

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="admin"' },
    });
  }

  const raw = auth.split(" ")[1];
  const [user, pass] = Buffer.from(raw, "base64").toString("utf8").split(":");
  const U = process.env.ADMIN_USER ?? "";
  const P = process.env.ADMIN_PASS ?? "";
  if (!U || user !== U || pass !== P) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
