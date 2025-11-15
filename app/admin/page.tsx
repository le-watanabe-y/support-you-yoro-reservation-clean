// app/admin/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  preferred_date: string;
  dropoff_time: string | null;
  time_slot: "am" | "pm" | null;
  guardian_name: string | null;
  email: string | null;
  child_name: string | null;
  child_birthdate: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  created_at: string;
};

function nowJST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AdminPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const today = useMemo(() => ymd(nowJST()), []);
  const tomorrow = useMemo(() => {
    const t = nowJST(); t.setDate(t.getDate() + 1); return ymd(t);
  }, []);

  const [dateFilter, setDateFilter] = useState<"today" | "tomorrow" | "all">("today");

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/reservations", { cache: "no-store" }).then(r => r.json());
      setItems(res?.items ?? []);
    } catch (e: any) {
      setMsg(e?.message || "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const display = useMemo(() => {
    const d = dateFilter === "today" ? today : dateFilter === "tomorrow" ? tomorrow : null;
    let arr = items;
    if (d) arr = arr.filter((r) => r.preferred_date === d);
    return arr;
  }, [items, dateFilter, today, tomorrow]);

  async function patch(id: string, status: Row["status"]) {
    setMsg(null);
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const t = await res.text();
      setMsg(`更新失敗: ${t}`);
    } else {
      await load();
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: "24px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>予約管理</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
        <button onClick={() => setDateFilter("today")}
          style={chip(dateFilter === "today")}>本日 ({today})</button>
        <button onClick={() => setDateFilter("tomorrow")}
          style={chip(dateFilter === "tomorrow")}>翌日 ({tomorrow})</button>
        <button onClick={() => setDateFilter("all")}
          style={chip(dateFilter === "all")}>すべて</button>

        <a
          href="/api/admin/export"
          style={{ marginLeft: "auto", textDecoration: "none", background: "#00A5E2", color: "#fff", padding: "8px 12px", borderRadius: 8, fontWeight: 600 }}
        >
          CSVダウンロード
        </a>
      </div>

      {msg && <p style={{ color: "#B91C1C" }}>{msg}</p>}
      {loading && <p>読み込み中…</p>}

      {/* スマホ優先のカードUI（freee 風） */}
      <div style={{ display: "grid", gap: 12 }}>
        {display.map((r) => (
          <div key={r.id} style={{ border: "1px solid #e5e7eb", borderRadius: 12, background: "#fff", padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, color: "#6b7280" }}>利用日</div>
                <div style={{ fontSize: 16, fontWeight: 700 }}>{r.preferred_date} <span style={{ fontSize: 13, color: "#6b7280" }}>({r.dropoff_time ?? "-"})</span></div>
              </div>
              <span style={badge(r.status)}>{r.status}</span>
            </div>

            <div style={{ marginTop: 8, fontSize: 14 }}>
              <div>保護者：{r.guardian_name ?? "-"}</div>
              <div>子ども：{r.child_name ?? "-"} / {r.child_birthdate ?? "-"}</div>
              <div>メール：{r.email ?? "-"}</div>
            </div>

            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => patch(r.id, "approved")} style={btn("#10B981")}>承認</button>
              <button onClick={() => patch(r.id, "rejected")} style={btn("#EF4444")}>却下</button>
              <button onClick={() => patch(r.id, "pending")}  style={btn("#6B7280")}>保留</button>
              <button onClick={() => patch(r.id, "canceled")} style={btn("#F59E0B")}>キャンセル</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    border: "1px solid " + (active ? "#00A5E2" : "#e5e7eb"),
    color: active ? "#00A5E2" : "#111827",
    background: active ? "#F0F9FF" : "#fff",
    padding: "6px 10px",
    borderRadius: 999,
    cursor: "pointer",
    fontWeight: 600,
  };
}
function btn(color: string): React.CSSProperties {
  return {
    background: color,
    color: "#fff",
    border: 0,
    padding: "8px 12px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: "pointer",
  };
}
function badge(status: string): React.CSSProperties {
  const colors: Record<string, string> = {
    approved: "#10B981",
    pending:  "#6B7280",
    rejected: "#EF4444",
    canceled: "#F59E0B",
  };
  const c = colors[status] || "#6B7280";
  return {
    background: c,
    color: "#fff",
    borderRadius: 8,
    padding: "4px 8px",
    fontSize: 12,
    fontWeight: 700,
  };
}
