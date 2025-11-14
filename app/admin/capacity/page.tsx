"use client";
import { useState, useEffect } from "react";

export default function AdminCapacityPage() {
  const [day, setDay] = useState<string>("");
  const [capacity, setCapacity] = useState<number>(3);
  const [msg, setMsg] = useState<string>("");

  return (
    <main style={{ padding: "16px", maxWidth: 720, margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 16 }}>日別定員の設定</h1>
      <div style={{ background: "#f6f7f8", padding: 16, borderRadius: 8 }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          対象日
          <input type="date" value={day} onChange={(e) => setDay(e.target.value)}
            style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </label>
        <label style={{ display: "block", marginBottom: 12 }}>
          定員
          <input type="number" min={0} value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </label>
        <button
          onClick={async () => {
            setMsg("");
            const res = await fetch("/api/admin/capacity", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ day, capacity }),
            });
            const json = await res.json();
            setMsg(json.ok ? "保存しました" : `保存失敗: ${json.message}`);
          }}
          style={{
            width: "100%",
            padding: "12px 16px",
            border: 0,
            borderRadius: 8,
            background: "#0070f3",
            color: "#fff",
            fontWeight: 600,
          }}
        >
          保存する
        </button>
        {msg && <p style={{ marginTop: 12 }}>{msg}</p>}
      </div>
    </main>
  );
}
