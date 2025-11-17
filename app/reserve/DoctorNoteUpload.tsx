"use client";

import { useState } from "react";

type Props = { onUploaded: (info: { path: string; mime: string; size: number }) => void };

export default function DoctorNoteUpload({ onUploaded }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setBusy(true); setError(null);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/upload/doctor-note", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok || !json?.ok) throw new Error(json?.message ?? "upload failed");
      onUploaded({ path: json.path, mime: json.mime, size: json.size });
      setDone(true);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label style={{ fontWeight: 600 }}>医師連絡表（必須／PDF・JPG・PNG／10MBまで）</label>
      <div style={{ marginTop: 8 }}>
        <input type="file" accept="application/pdf,image/jpeg,image/png" onChange={onChange} disabled={busy} />
      </div>
      {busy && <p>アップロード中…</p>}
      {done && <p style={{ color: "green" }}>アップロード済み</p>}
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </div>
  );
}
