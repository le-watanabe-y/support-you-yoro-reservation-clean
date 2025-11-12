"use client";
import { useState } from "react";

type FormState = {
  guardianName: string;
  email: string;
  preferredDate: string; // YYYY-MM-DD
  notes: string;
};

export default function Home() {
  const [form, setForm] = useState<FormState>({
    guardianName: "",
    email: "",
    preferredDate: "",
    notes: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">(
    "idle"
  );
  const [message, setMessage] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setMessage("");

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || "送信に失敗しました");

      setStatus("done");
      setMessage(`送信しました。受付番号: ${json.id ?? "—"}`);
      setForm({ guardianName: "", email: "", preferredDate: "", notes: "" });
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "送信に失敗しました");
    }
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: 720 }}>
      <h1>サポート予約フォーム</h1>
      <p style={{ color: "#666" }}>以下の項目をご入力のうえ送信してください。</p>

      <form onSubmit={onSubmit} style={{ marginTop: "1.5rem" }}>
        <label style={{ display: "block", marginBottom: 12 }}>
          保護者名（必須）
          <input
            required
            value={form.guardianName}
            onChange={(e) =>
              setForm((f) => ({ ...f, guardianName: e.target.value }))
            }
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          メールアドレス（必須）
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) =>
              setForm((f) => ({ ...f, email: e.target.value }))
            }
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 12 }}>
          希望日（必須）
          <input
            type="date"
            required
            value={form.preferredDate}
            onChange={(e) =>
              setForm((f) => ({ ...f, preferredDate: e.target.value }))
            }
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <label style={{ display: "block", marginBottom: 16 }}>
          メモ（任意）
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) =>
              setForm((f) => ({ ...f, notes: e.target.value }))
            }
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </label>

        <button
          disabled={status === "saving"}
          type="submit"
          style={{
            padding: "10px 16px",
            background: "#0070f3",
            color: "#fff",
            border: 0,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          {status === "saving" ? "送信中…" : "送信"}
        </button>

        {message && (
          <p
            style={{
              marginTop: 12,
              color: status === "error" ? "#c00" : "#067c06",
            }}
          >
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
