"use client";

import { useEffect, useMemo, useState } from "react";

type Availability = {
  ok: boolean;
  date: string;
  left: { total: number; am: number; pm: number };
  available: { am: boolean; pm: boolean };
  canReserve: boolean;
};

type Form = {
  guardian_name: string;
  email: string;
  guardian_phone: string;
  child_name: string;
  child_birthdate: string; // YYYY-MM-DD
  child_allergy: string;
  date: string; // YYYY-MM-DD
  period: "am" | "pm" | "";
  notes: string;
};

export default function Home() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [form, setForm] = useState<Form>({
    guardian_name: "",
    email: "",
    guardian_phone: "",
    child_name: "",
    child_birthdate: "",
    child_allergy: "",
    date: today,
    period: "",
    notes: "",
  });
  const [avail, setAvail] = useState<Availability | null>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "saving" | "done" | "error">("idle");
  const [message, setMessage] = useState("");

  // 空き状況を取得
  useEffect(() => {
    if (!form.date) return;
    setStatus("checking");
    fetch(`/api/availability?date=${form.date}`)
      .then((r) => r.json())
      .then((j) => setAvail(j))
      .catch(() => setAvail(null))
      .finally(() => setStatus("idle"));
  }, [form.date]);

  function set<K extends keyof Form>(key: K, v: Form[K]) {
    setForm((f) => ({ ...f, [key]: v }));
  }

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
      // 初期化
      setForm((f) => ({
        ...f,
        guardian_name: "",
        email: "",
        guardian_phone: "",
        child_name: "",
        child_birthdate: "",
        child_allergy: "",
        period: "",
        notes: "",
      }));
      // 空き状況更新
      const r = await fetch(`/api/availability?date=${form.date}`);
      setAvail(await r.json());
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message ?? "送信に失敗しました");
    }
  }

  const amDisabled =
    !avail?.ok || !avail?.canReserve || avail?.available.am === false;
  const pmDisabled =
    !avail?.ok || !avail?.canReserve || avail?.available.pm === false;

  return (
    <main style={{ padding: "16px", fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>サポート予約フォーム</h1>
      <p style={{ color: "#666", margin: 0 }}>
        各項目をご入力のうえ送信してください。
      </p>

      {/* 空き状況 */}
      <section
        style={{
          marginTop: 12,
          padding: 12,
          border: "1px solid #e5e7eb",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label style={{ fontWeight: 600 }}>希望日</label>
          <input
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value as Form["date"])}
            style={{ padding: 8, border: "1px solid #d1d5db", borderRadius: 6 }}
          />
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#6b7280" }}>
            {avail?.ok
              ? `空き：午前 ${avail.left.am} / 午後 ${avail.left.pm}（残り・総 ${avail.left.total}）`
              : "空き状況を確認中…"}
          </span>
        </div>
        {!avail?.canReserve && (
          <div style={{ marginTop: 8, color: "#b91c1c" }}>
            この日は受付できません（期間外/休園日/定員超過）。
          </div>
        )}
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <label style={pill(amDisabled, form.period === "am")}>
            <input
              type="radio"
              name="period"
              value="am"
              disabled={amDisabled}
              checked={form.period === "am"}
              onChange={() => set("period", "am")}
              style={{ display: "none" }}
            />
            午前
          </label>
          <label style={pill(pmDisabled, form.period === "pm")}>
            <input
              type="radio"
              name="period"
              value="pm"
              disabled={pmDisabled}
              checked={form.period === "pm"}
              onChange={() => set("period", "pm")}
              style={{ display: "none" }}
            />
            午後
          </label>
        </div>
      </section>

      {/* 入力フォーム */}
      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <Field label="保護者名（必須）">
          <input
            required
            value={form.guardian_name}
            onChange={(e) => set("guardian_name", e.target.value)}
            style={input}
          />
        </Field>

        <Field label="メール（必須）">
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            style={input}
            inputMode="email"
          />
        </Field>

        <Field label="電話番号">
          <input
            value={form.guardian_phone}
            onChange={(e) => set("guardian_phone", e.target.value)}
            style={input}
            inputMode="tel"
          />
        </Field>

        <Field label="お子さま氏名（必須）">
          <input
            required
            value={form.child_name}
            onChange={(e) => set("child_name", e.target.value)}
            style={input}
          />
        </Field>

        <Field label="お子さま生年月日（必須）">
          <input
            type="date"
            required
            value={form.child_birthdate}
            onChange={(e) => set("child_birthdate", e.target.value)}
            style={input}
          />
        </Field>

        <Field label="アレルギー（任意）">
          <input
            value={form.child_allergy}
            onChange={(e) => set("child_allergy", e.target.value)}
            style={input}
          />
        </Field>

        <Field label="メモ（任意）">
          <textarea
            rows={4}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            style={{ ...input, height: "auto" }}
          />
        </Field>

        <button
          disabled={status === "saving" || !avail?.canReserve}
          type="submit"
          style={button}
        >
          {status === "saving" ? "送信中…" : "送信"}
        </button>

        {message && (
          <p
            style={{
              marginTop: 12,
              color: status === "error" ? "#b91c1c" : "#065f46",
              fontWeight: 600,
            }}
          >
            {message}
          </p>
        )}
      </form>
    </main>
  );
}

const input: React.CSSProperties = {
  width: "100%",
  padding: 10,
  border: "1px solid #d1d5db",
  borderRadius: 6,
};

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 12 }}>
      <div style={{ fontSize: 13, marginBottom: 6, color: "#374151" }}>{props.label}</div>
      {props.children}
    </label>
  );
}

const button: React.CSSProperties = {
  padding: "10px 16px",
  background: "#0070f3",
  color: "#fff",
  border: 0,
  borderRadius: 8,
  cursor: "pointer",
};

function pill(disabled: boolean, active: boolean): React.CSSProperties {
  return {
    userSelect: "none",
    padding: "6px 12px",
    borderRadius: 999,
    border: "1px solid " + (active ? "#0ea5e9" : "#d1d5db"),
    color: disabled ? "#9ca3af" : active ? "#0369a1" : "#111827",
    background: active ? "#e0f2fe" : "#fff",
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
  };
}
