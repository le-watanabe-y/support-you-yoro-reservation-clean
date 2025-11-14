"use client";

import { useEffect, useState } from "react";

type Row = {
  id: string;
  status: "pending" | "approved" | "rejected" | "canceled" | null;
  preferred_date?: string | null;
  time_slot?: string | null;
  guardian_name?: string | null;
  guardian_phone?: string | null;
  child_name?: string | null;
  created_at?: string | null;
};

export default function AdminPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/reservations", { cache: "no-store" });
    const json = await res.json();
    setItems(json?.items ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: "approved" | "rejected") {
    await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    await load();
  }

  return (
    <main style={{ padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>予約一覧</h1>

      {loading ? (
        <p style={{ color: "#6b7280" }}>読み込み中…</p>
      ) : (
        <div
          style={{
            overflowX: "auto",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 12,
          }}
        >
          <table style={{ width: "100%", fontSize: 14, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f6f7f8" }}>
                <th style={th}>受付</th>
                <th style={th}>ステータス</th>
                <th style={th}>日付/帯</th>
                <th style={th}>保護者</th>
                <th style={th}>電話</th>
                <th style={th}>子ども</th>
                <th style={th}>作成</th>
                <th style={th}>操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid #e5e7eb" }}>
                  <td style={td}>{r.id}</td>
                  <td style={td}>
                    <span style={badgeStyle(r.status)}>{r.status ?? "pending"}</span>
                  </td>
                  <td style={td}>
                    {r.preferred_date ?? "-"} / {r.time_slot ?? "-"}
                  </td>
                  <td style={td}>{r.guardian_name ?? "-"}</td>
                  <td style={td}>{r.guardian_phone ?? "-"}</td>
                  <td style={td}>{r.child_name ?? "-"}</td>
                  <td style={td}>
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "-"}
                  </td>
                  <td style={td}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        onClick={() => setStatus(r.id, "approved")}
                        disabled={r.status === "approved"}
                        style={btn("#0ea5e9")}
                      >
                        承認
                      </button>
                      <button
                        onClick={() => setStatus(r.id, "rejected")}
                        disabled={r.status === "rejected"}
                        style={btn("#ef4444")}
                      >
                        却下
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  whiteSpace: "nowrap",
};
const td: React.CSSProperties = {
  padding: "10px 12px",
  whiteSpace: "nowrap",
};

function btn(color: string): React.CSSProperties {
  return {
    padding: "6px 10px",
    borderRadius: 8,
    border: "none",
    background: color,
    color: "#fff",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  };
}

function badgeStyle(status: Row["status"]): React.CSSProperties {
  const base: React.CSSProperties = {
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    background: "#fff",
    display: "inline-block",
  };
  switch (status ?? "pending") {
    case "approved":
      return { ...base, color: "#065f46", background: "#ecfdf5", borderColor: "#a7f3d0" };
    case "rejected":
      return { ...base, color: "#991b1b", background: "#fef2f2", borderColor: "#fecaca" };
    case "canceled":
      return { ...base, color: "#374151", background: "#f3f4f6", borderColor: "#e5e7eb" };
    default:
      return { ...base, color: "#92400e", background: "#fff7ed", borderColor: "#fed7aa" };
  }
}
