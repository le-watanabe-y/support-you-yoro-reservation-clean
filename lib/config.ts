// lib/config.ts（全置き換え）
export const ADMIN_USER = process.env.ADMIN_USER ?? "";
export const ADMIN_PASS = process.env.ADMIN_PASS ?? "";

/** Basic 認証（Vercel の ADMIN_USER / ADMIN_PASS を使用） */
export function okAuth(req: Request): boolean {
  if (!ADMIN_USER || !ADMIN_PASS) return true; // 未設定ならチェックをスキップ

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Basic ")) return false;

  const base64 = header.slice(6).trim();
  let decoded = "";
  try {
    decoded = Buffer.from(base64, "base64").toString("utf8");
  } catch {
    return false;
  }
  const i = decoded.indexOf(":");
  if (i < 0) return false;

  const user = decoded.slice(0, i);
  const pass = decoded.slice(i + 1);
  return user === ADMIN_USER && pass === ADMIN_PASS;
}
