// lib/adminAuth.ts
import type { NextRequest } from "next/server";

export function okAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Basic ")) return false;

  const raw = auth.split(" ")[1];
  const decoded = Buffer.from(raw, "base64").toString("utf8"); // "user:pass"
  const [user, pass] = decoded.split(":");

  const U = process.env.ADMIN_USER ?? "";
  const P = process.env.ADMIN_PASS ?? "";
  return Boolean(U) && user === U && pass === P;
}
