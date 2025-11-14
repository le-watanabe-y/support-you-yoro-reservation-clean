"use client";
import { useEffect, useState } from "react";

type Item = {
  id: string | number;
  guardian_name: string | null;
  email: string | null;
  guardian_phone: string | null;
  child_name: string | null;
  child_birthdate: string | null;
  child_allergy: string | null;
  preferred_date: string | null;
  notes: string | null;
  status: "pending" | "approved" | "canceled";
  created_at: string | null;
};

export default function AdminPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/reservations", { cache: "no-store" });
    const json = await res.json();
    setItems(json.items ?? []);
  }

  useEffect(() => { load(); }, []);

  async function update(id: Item["id"], status: Item["status"]) {
    setBusy(String(id));
    try {
      await fetch("/api/admin/reservations/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: 1200, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16 }}>予約一覧（管理）</h1>

      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 900 }}>
          <thead>
            <tr>
              <Th>受付番号</Th><Th>保護者</Th><Th className="hide-sm">メール</Th><Th>電話</Th>
              <Th>お子さま</Th><Th>生年月日</Th><Th>アレルギー</Th>
              <Th>希望日</Th><Th className="hide-sm">メモ</Th><Th>状態</Th><Th>操作</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((r) => (
              <tr key={String(r.id)} style={{ borderTop: "1px solid #f2f2f2" }}>
                <Td>{r.id}</Td>
                <Td>{r.guardian_name}</Td>
                <Td className="hide-sm">{r.email}</Td>
                <Td>{r.guardian_phone}</Td>
                <Td>{r.child_name}</Td>
                <Td>{r.child_birthdate}</Td>
                <Td>{r.child_allergy}</Td>
                <Td>{r.preferred_date}</Td>
                <Td className="hide-sm">{r.notes}</Td>
                <Td>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: 999,
                      background:
                        r.status === "approved" ? "#e6f4ea" : r.status === "canceled" ? "#fde8e8" : "#eef2ff",
                      color: r.status === "approved" ? "#137333" : r.status === "canceled" ? "#c00" : "#3740ff",
                      fontWeight: 600,
                    }}
                  >
                    {r.status}
                  </span>
                </Td>
                <Td>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <Btn disabled={busy === String(r.id)} onClick={() => update(r.id, "approved")}>承認</Btn>
                    <Btn disabled={busy === String(r.id)} onClick={() => update(r.id, "pending")}>保留</Btn>
                    <Btn disabled={busy === String(r.id)} onClick={() => update(r.id, "canceled")}>取消</Btn>
                  </div>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* スマホ: メール/メモ列を隠す（styled-jsx は使わず、シンプルに） */}
      <style>{`
        @media (max-width: 640px) {
          .hide-sm { display: none; }
        }
      `}</style>
    </main>
  );
}

const cell = { padding: "10px 8px", textAlign: "left", verticalAlign: "top" } as const;

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={className} style={{ ...cell, color: "#6b7280", fontWeight: 600 }}>
      {children}
    </th>
  );
}
function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={className} style={cell}>
      {children}
    </td>
  );
}
function Btn(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      style={{
        padding: "6px 10px",
        border: "1px solid #e5e7eb",
        borderRadius: 6,
        background: "#fff",
        cursor: props.disabled ? "not-allowed" : "pointer",
      }}
    />
  );
}
