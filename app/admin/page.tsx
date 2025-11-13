// app/admin/page.tsx
import { headers } from "next/headers";

export const dynamic = "force-dynamic"; // 最新を毎回取得

export default async function AdminPage() {
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host") ?? "";
  const base = `${proto}://${host}`;

  const res = await fetch(`${base}/api/reservations`, { cache: "no-store" });
  const data: { ok: boolean; items: any[] } = await res.json();

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 900 }}>
      <h1>予約一覧</h1>
      <p style={{ color: "#666" }}>最新の予約が新しい順に表示されます。</p>

      {!data?.ok ? (
        <p style={{ color: "#c00" }}>取得に失敗しました。</p>
      ) : data.items.length === 0 ? (
        <p>まだ予約はありません。</p>
      ) : (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 16,
            fontSize: 14,
          }}
        >
          <thead>
            <tr>
              <th style={th}>受付ID</th>
              <th style={th}>保護者名</th>
              <th style={th}>メール</th>
              <th style={th}>希望日</th>
              <th style={th}>メモ</th>
              <th style={th}>作成時刻</th>
            </tr>
          </thead>
          <tbody>
            {data.items
              .slice()
              .reverse()
              .map((r: any) => (
                <tr key={r.id}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>{r.guardianName}</td>
                  <td style={td}>{r.email}</td>
                  <td style={td}>{r.preferredDate}</td>
                  <td style={td}>{r.notes ?? ""}</td>
                  <td style={td}>{r.createdAt}</td>
                </tr>
              ))}
          </tbody>
        </table>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  borderBottom: "1px solid #ddd",
  padding: "6px 8px",
  background: "#fafafa",
};
const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "6px 8px",
};
