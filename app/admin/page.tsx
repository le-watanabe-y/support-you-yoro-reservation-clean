// app/admin/page.tsx  （全置き換え）
"use client";
import { useEffect, useState } from "react";

type Row = {
  id: string;
  created_at: string;
  preferred_date: string;
  dropoff_time: string | null;
  time_slot: "am" | "pm" | null;
  guardian_name: string | null;
  email: string | null;
  child_name: string | null;
  child_birthdate: string | null;
  status: "pending" | "approved" | "rejected" | "canceled";
  notes: string | null;
};

export default function AdminPage() {
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  async function load() {
    setLoading(true);
    setErr("");
    try {
      const res = await fetch("/api/reservations", { cache: "no-store" });
      const json = await res.json();
      setItems(json.items ?? []);
    } catch (e: any) {
      setErr(e?.message ?? "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function setStatus(id: string, status: Row["status"]) {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      alert("更新に失敗しました（まず『管理APIにサインイン』を押して認証してください）");
      return;
    }
    await load();
  }

  async function setTime(id: string, hhmm: string) {
    const res = await fetch(`/api/admin/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dropoff_time: hhmm }),
    });
    if (!res.ok) {
      alert("時刻更新に失敗しました（まず『管理APIにサインイン』を押して認証してください）");
      return;
    }
    await load();
  }

  const box: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: 12,
    display: "grid",
    gap: 8,
  };

  const tag: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    border: "1px solid #e5e7eb",
    fontSize: 12,
  };

  function StatusTag({ s }: { s: Row["status"] }) {
    const color =
      s === "approved" ? "#065f46" :
      s === "pending"  ? "#92400e" :
      s === "rejected" ? "#991b1b" : "#374151";
    const bg =
      s === "approved" ? "#ecfdf5" :
      s === "pending"  ? "#fffbeb" :
      s === "rejected" ? "#fef2f2" : "#f3f4f6";
    return (
      <span style={{ ...tag, color, background: bg, borderColor: bg }}>{s}</span>
    );
  }

  return (
    <main style={{ padding: 16, maxWidth: 960, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>予約一覧（管理）</h1>

      <div style={{ marginBottom: 12, fontSize: 12, color: "#6b7280" }}>
        まず <a href="/api/admin/export" target="_blank" rel="noreferrer">管理APIにサインイン</a> してください（Basic）。  
        その後、このページのボタン操作が通ります。
      </div>

      <div style={{ display: "grid", gap: 12 }}>
        {loading && <div>読み込み中…</div>}
        {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
        {!loading && items.length === 0 && <div>データがありません。</div>}

        {items.map((x) => (
          <div key={x.id} style={box}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <strong>{x.preferred_date}</strong>
              <span style={tag}>{x.dropoff_time ?? "—"}</span>
              {x.time_slot && <span style={tag}>{x.time_slot}</span>}
              <StatusTag s={x.status} />
              <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
                受付: {new Date(x.created_at).toLocaleString()}
              </span>
            </div>

            <div style={{ display: "grid", gap: 6, fontSize: 14 }}>
              <div>保護者: {x.guardian_name ?? "—"} / {x.email ?? "—"}</div>
              <div>お子さま: {x.child_name ?? "—"}（{x.child_birthdate ?? "—"}）</div>
              {x.notes && <div style={{ whiteSpace: "pre-wrap" }}>メモ: {x.notes}</div>}
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => setStatus(x.id, "approved")}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#ecfdf5" }}>
                承認
              </button>
              <button onClick={() => setStatus(x.id, "pending")}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fffbeb" }}>
                保留
              </button>
              <button onClick={() => setStatus(x.id, "rejected")}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#fef2f2" }}>
                却下
              </button>
              <button onClick={() => setStatus(x.id, "canceled")}
                style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", background: "#f3f4f6" }}>
                取消
              </button>

              <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
                <label style={{ fontSize: 12, color: "#6b7280" }}>時刻修正:</label>
                <input
                  type="time"
                  value={x.dropoff_time ?? ""}
                  onChange={(e) => setTime(x.id, e.target.value)}
                  style={{ padding: 6, border: "1px solid #d1d5db", borderRadius: 6 }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
