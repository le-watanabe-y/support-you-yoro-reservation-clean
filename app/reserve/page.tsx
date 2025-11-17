"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type FormState = {
  guardian_name: string;
  guardian_phone: string;
  child_name: string;
  child_birthdate: string;
  preferred_date: string;
  dropoff_time: string;
};

export default function ReservePage() {
  const router = useRouter();
  const [state, setState] = useState<FormState>({
    guardian_name: "",
    guardian_phone: "",
    child_name: "",
    child_birthdate: "",
    preferred_date: "",
    dropoff_time: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onChange =
    (k: keyof FormState) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setState((s) => ({ ...s, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);

    if (!file) {
      setErr("医師連絡表（画像 / PDF）の添付が必須です。");
      return;
    }
    const okTypes = ["image/png", "image/jpeg", "application/pdf"];
    if (!okTypes.includes(file.type)) {
      setErr("添付できるファイルは PNG / JPG / PDF のみです。");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("ファイルサイズは 5MB 以内にしてください。");
      return;
    }

    try {
      setSubmitting(true);
      const fd = new FormData();
      Object.entries(state).forEach(([k, v]) => fd.append(k, v));
      fd.append("medical_letter", file);

      const res = await fetch("/api/reservations", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "送信に失敗しました");

      router.push(`/reserve/thanks?id=${encodeURIComponent(json.id)}&status=${json.status ?? "pending"}`);
    } catch (e: any) {
      setErr(e?.message ?? "送信に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>病児保育 予約フォーム</h1>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, maxWidth: 520 }}>
        <label>
          保護者氏名
          <input required value={state.guardian_name} onChange={onChange("guardian_name")} />
        </label>
        <label>
          連絡先（電話）
          <input required value={state.guardian_phone} onChange={onChange("guardian_phone")} />
        </label>
        <label>
          お子さま氏名
          <input required value={state.child_name} onChange={onChange("child_name")} />
        </label>
        <label>
          お子さま生年月日
          <input type="date" required value={state.child_birthdate} onChange={onChange("child_birthdate")} />
        </label>
        <label>
          利用日
          <input type="date" required value={state.preferred_date} onChange={onChange("preferred_date")} />
        </label>

        <label>
          預け希望時刻
          <select required value={state.dropoff_time} onChange={onChange("dropoff_time")}>
            <option value="">選択してください</option>
            {Array.from({ length: 24 * 2 }).map((_, i) => {
              const hh = String(Math.floor(i / 2)).padStart(2, "0");
              const mm = i % 2 === 0 ? "00" : "30";
              const t = `${hh}:${mm}`;
              return (
                <option key={t} value={t}>
                  {t}
                </option>
              );
            })}
          </select>
        </label>

        <label>
          医師連絡表（画像 / PDF） <span style={{ color: "#ef4444" }}>*必須</span>
          <input
            type="file"
            accept="image/png,image/jpeg,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            required
          />
          <small style={{ color: "#6b7280" }}>※ PNG / JPG / PDF、5MB 以内</small>
        </label>

        {err && <p style={{ color: "#ef4444" }}>{err}</p>}

        <button disabled={submitting} type="submit" style={{ padding: "10px 16px" }}>
          {submitting ? "送信中…" : "申し込む"}
        </button>
      </form>
    </main>
  );
}
