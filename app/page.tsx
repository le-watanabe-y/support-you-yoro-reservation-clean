"use client";
import { useEffect, useState } from "react";

type FormState = {
  guardianName: string;
  email: string;
  preferredDate: string; // YYYY-MM-DD
  notes: string;
  childName?: string;
  childBirthdate?: string; // YYYY-MM-DD
  childAllergy?: string;
  guardianPhone?: string;
};

export default function Home() {
  const [form, setForm] = useState<FormState>({
    guardianName: "",
    email: "",
    preferredDate: "",
    notes: "",
  });
  const [status, setStatus] = useState<"idle" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState<string>("");

  // 定員情報
  const [remaining, setRemaining] = useState<number | null>(null);
  const [capacity, setCapacity] = useState<number | null>(null);
  const [loadingCap, setLoadingCap] = useState(false);

  useEffect(() => {
    const load = async () => {
      setRemaining(null);
      setCapacity(null);
      if (!form.preferredDate) return;
      setLoadingCap(true);
      const res = await fetch(`/api/capacity?date=${form.preferredDate}`, { cache: "no-store" });
      const json = await res.json();
      if (json?.ok) {
        setCapacity(json.capacity);
        setRemaining(json.remaining);
      }
      setLoadingCap(false);
    };
    load();
  }, [form.preferredDate]);

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
      setRemaining(null);
      setCapacity(null);
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "送信に失敗しました");
    }
  }

  const canSubmit =
    form.guardianName && form.email && form.preferredDate && (remaining ?? 1) > 0 && status !== "saving";

  return (
    <main style={{ padding: "16px", maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 8 }}>サポート予約フォーム</h1>
      <p style={{ color: "#666", fontSize: 13, marginBottom: 16 }}>
        スマホに最適化したシンプルなフォームです。必要事項をご入力ください。
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <section style={{ background: "#f6f7f8", padding: 12, borderRadius: 8 }}>
          <label style={{ display: "block", marginBottom: 10 }}>
            保護者名（必須）
            <input
              required
              value={form.guardianName}
              onChange={(e) => setForm((f) => ({ ...f, guardianName: e.target.value }))}
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            メールアドレス（必須）
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            希望日（必須）
            <input
              type="date"
              required
              value={form.preferredDate}
              onChange={(e) => setForm((f) => ({ ...f, preferredDate: e.target.value }))}
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
            <div style={{ marginTop: 6, fontSize: 12, color: "#555" }}>
              {loadingCap && "残枠を確認中…"}
              {!loadingCap && remaining !== null && capacity !== null && (
                <span>
                  {remaining > 0 ? `残り ${remaining} 枠（定員 ${capacity}）` : "満席です"}
                </span>
              )}
            </div>
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            お子さまの氏名（任意）
            <input
              value={form.childName ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, childName: e.target.value }))}
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            生年月日（任意）
            <input
              type="date"
              value={form.childBirthdate ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, childBirthdate: e.target.value }))}
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            アレルギー（任意）
            <input
              value={form.childAllergy ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, childAllergy: e.target.value }))}
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "block", marginBottom: 10 }}>
            保護者の電話番号（任意）
            <input
              inputMode="tel"
              value={form.guardianPhone ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, guardianPhone: e.target.value }))}
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>

          <label style={{ display: "block" }}>
            メモ（任意）
            <textarea
              rows={4}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} 
              style={{ width: "100%", padding: 12, marginTop: 6, borderRadius: 6, border: "1px solid #ddd" }}
            />
          </label>
        </section>

        <button
          disabled={!canSubmit}
          type="submit"
          style={{
            padding: "14px 16px",
            background: canSubmit ? "#0070f3" : "#9bbcf7",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            fontWeight: 700,
          }}
        >
          {status === "saving" ? "送信中…" : "送信"}
        </button>

        {message && (
          <p style={{ marginTop: 8, color: status === "error" ? "#c00" : "#067c06", fontSize: 14 }}>
            {message}
          </p>
        )}
      </form>
    </main>
  );
}
