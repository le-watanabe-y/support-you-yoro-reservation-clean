"use client";
import { useState } from "react";

type FormState = {
  guardianName: string;
  email: string;
  preferredDate: string; // YYYY-MM-DD
  dropoffTime: string;   // HH:mm
  notes: string;
};

export default function Home() {
  const [form, setForm] = useState<FormState>({
    guardianName: "",
    email: "",
    preferredDate: "",
    dropoffTime: "", // 追加
    notes: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardian_name: form.guardianName,
          email: form.email,
          preferred_date: form.preferredDate,
          dropoff_time: form.dropoffTime, // ← これだけ送ればOK（サーバでAM/PMを自動判定）
          notes: form.notes,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "送信に失敗しました");

      setStatus("done");
      setMessage(`送信しました。受付番号: ${json.id ?? "—"}（${json.status}）`);
      setForm({ guardianName: "", email: "", preferredDate: "", dropoffTime: "", notes: "" });
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "送信に失敗しました");
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: 12,
    marginTop: 6,
    border: "1px solid #ddd",
    borderRadius: 8,
    fontSize: 16,
  };

  return (
    <main style={{ padding: "20px", fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>サポート予約フォーム</h1>
      <p style={{ color: "#666" }}>必要事項をご入力ください（スマホ対応）。</p>

      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          保護者名（必須）
          <input
            required
            value={form.guardianName}
            onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          メールアドレス（必須）
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            style={inputStyle}
          />
        </label>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
          <label style={{ display: "block" }}>
            希望日（必須）
            <input
              type="date"
              required
              value={form.preferredDate}
              onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
              style={inputStyle}
            />
          </label>

          <label style={{ display: "block" }}>
            預け時間（必須）
            <input
              type="time"
              required
              step={900} // 15分刻み：スマホのUIが扱いやすい
              value={form.dropoffTime}
              onChange={(e) => setForm((f) => ({ ...f, dropoffTime: e.target.value }))}
              style={inputStyle}
            />
          </label>
        </div>

        <label style={{ display: "block", marginBottom: 16 }}>
          メモ（任意）
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            style={{ ...inputStyle, fontFamily: "inherit" }}
          />
        </label>

        <button
          disabled={status === "saving"}
          type="submit"
          style={{
            width: "100%",
            padding: "12px 16px",
            background: "#0070f3",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            fontSize: 16,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {status === "saving" ? "送信中…" : "送信"}
        </button>

        {message && (
          <p style={{ marginTop: 12, color: status === "error" ? "#c00" : "#067c06" }}>
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
