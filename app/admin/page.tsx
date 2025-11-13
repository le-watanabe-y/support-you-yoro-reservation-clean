"use client";
<p style={{ textAlign: 'right', margin: '8px 0' }}>
  <a href="/api/admin/export">CSVダウンロード</a>
</p>

import { useEffect, useState } from "react";

type Item = {
  id: string;
  guardianName: string;
  email: string;
  preferredDate: string;
  notes?: string;
  createdAt: string;
};

export default function AdminPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/reservations", { cache: "no-store" });
        const j = await r.json();
        setItems(j.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>予約一覧</h1>
      {loading ? (
        <p>読み込み中…</p>
      ) : items.length === 0 ? (
        <p>まだ予約はありません。</p>
      ) : (
        <table
          style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}
        >
          <thead>
            <tr>
              <th style={th}>受付番号</th>
              <th style={th}>保護者名</th>
              <th style={th}>メール</th>
              <th style={th}>希望日</th>
              <th style={th}>メモ</th>
              <th style={th}>作成日時</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.id}>
                <td style={td}>{x.id}</td>
                <td style={td}>{x.guardianName}</td>
                <td style={td}>{x.email}</td>
                <td style={td}>{x.preferredDate}</td>
                <td style={td}>{x.notes ?? ""}</td>
                <td style={td}>{new Date(x.createdAt).toLocaleString()}</td>
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
  padding: "8px",
  background: "#fafafa",
};

const td: React.CSSProperties = {
  borderBottom: "1px solid #eee",
  padding: "8px",
};
