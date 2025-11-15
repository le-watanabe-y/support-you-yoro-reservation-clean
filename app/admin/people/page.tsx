"use client";

import { useEffect, useMemo, useState } from "react";

/** reservations API の返却想定 */
type ResRow = {
  id: string;
  created_at: string;
  preferred_date: string; // YYYY-MM-DD
  dropoff_time: string;   // HH:MM
  status: "pending" | "approved" | "rejected" | "canceled";
  guardian_name: string;
  email: string;
  child_name?: string | null;
  child_birthdate?: string | null; // YYYY-MM-DD
};

type Person = {
  key: string;
  guardian_name: string;
  email: string;
  children: { name: string; birthdate?: string | null }[];
  first_date: string;
  last_date: string;
  count: number;
};

const css: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 980, margin: "22px auto", padding: "0 16px" },
  h1: { fontSize: 20, fontWeight: 800, marginBottom: 12 },
  card: { background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 12, marginBottom: 10 },
  row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  input: { height: 34, border: "1px solid #CBD5E1", borderRadius: 8, padding: "0 10px", minWidth: 220 },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", background: "#F8FAFC", padding: "10px 12px", fontSize: 12, color: "#475569", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" },
  td: { padding: "10px 12px", fontSize: 14, borderBottom: "1px solid #F1F5F9", verticalAlign: "top" },
  small: { fontSize: 12, color: "#64748B" },
  btn: { height: 34, padding: "0 10px", border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" },
};

export default function PeoplePage() {
  const [rows, setRows] = useState<ResRow[]>([]);
  const [loading, setLoading] = useState(true);

  // 画面上の検索 / 期間（任意）
  const [q, setQ] = useState("");
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // 既存の /api/reservations を利用（全件想定）
        const r = await fetch("/api/reservations", { cache: "no-store" });
        const j = await r.json();
        setRows(j?.items ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // フィルタ
  const filtered = useMemo(() => {
    let arr = rows;
    if (start) arr = arr.filter((r) => r.preferred_date >= start);
    if (end)   arr = arr.filter((r) => r.preferred_date <= end);

    const s = q.trim().toLowerCase();
    if (s) {
      arr = arr.filter((r) =>
        (r.guardian_name ?? "").toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.child_name ?? "").toLowerCase().includes(s)
      );
    }
    return arr;
  }, [rows, q, start, end]);

  // 保護者（email+name）で集計
  const people = useMemo(() => {
    const map = new Map<string, Person>();
    for (const r of filtered) {
      const emailKey = (r.email ?? "").toLowerCase();
      const nameKey = r.guardian_name ?? "";
      const key = `${emailKey}|${nameKey}`;

      if (!map.has(key)) {
        map.set(key, {
          key,
          guardian_name: r.guardian_name ?? "",
          email: r.email ?? "",
          children: [],
          first_date: r.preferred_date,
          last_date: r.preferred_date,
          count: 0,
        });
      }
      const p = map.get(key)!;
      p.count += 1;
      if (r.preferred_date < p.first_date) p.first_date = r.preferred_date;
      if (r.preferred_date > p.last_date)  p.last_date = r.preferred_date;

      const cname = (r.child_name ?? "").trim();
      const cb = (r.child_birthdate ?? "") || null;
      if (cname) {
        const exists = p.children.some((c) => c.name === cname && (c.birthdate ?? "") === (cb ?? ""));
        if (!exists) p.children.push({ name: cname, birthdate: cb });
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.guardian_name || "").localeCompare(b.guardian_name || ""))
  }, [filtered]);

  function downloadCSV() {
    const params = new URLSearchParams();
    if (start) params.set("start", start);
    if (end)   params.set("end", end);
    if (q.trim()) params.set("q", q.trim());
    const url = `/api/export/people-csv?${params.toString()}`;
    window.location.href = url;
  }

  return (
    <main style={css.wrap}>
      <h1 style={css.h1}>利用者一覧（予約実績ベース）</h1>

      <div style={css.card}>
        <div style={css.row}>
          <input
            style={css.input}
            placeholder="保護者名 / メール / お子さま名で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <span style={css.small}>期間（任意）：</span>
          <input type="date" style={css.input} value={start} onChange={(e) => setStart(e.target.value)} />
          <span>〜</span>
          <input type="date" style={css.input} value={end} onChange={(e) => setEnd(e.target.value)} />
          <button style={css.btn} onClick={() => { setStart(""); setEnd(""); }}>期間クリア</button>
          <button style={css.btn} onClick={downloadCSV}>CSVダウンロード</button>
        </div>
        <div style={{ ...css.small, marginTop: 6 }}>
          ※ この一覧は <code>reservations</code> テーブルの実績から集計しています。
        </div>
      </div>

      <div style={css.tableWrap}>
        <table style={css.table}>
          <thead>
            <tr>
              <th style={css.th}>保護者名</th>
              <th style={css.th}>メール</th>
              <th style={css.th}>お子さま一覧</th>
              <th style={css.th}>初回利用</th>
              <th style={css.th}>最終利用</th>
              <th style={css.th}>予約件数</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td style={css.td} colSpan={6}>読み込み中…</td></tr>
            )}
            {!loading && people.length === 0 && (
              <tr><td style={css.td} colSpan={6}>該当なし</td></tr>
            )}
            {!loading && people.map((p) => (
              <tr key={p.key}>
                <td style={css.td}><strong>{p.guardian_name || "（未入力）"}</strong></td>
                <td style={css.td}>{p.email || "（未入力）"}</td>
                <td style={css.td}>
                  {p.children.length === 0 ? "—" : p.children.map((c, i) => (
                    <span key={i} style={{ marginRight: 8 }}>
                      {c.name}{c.birthdate ? `（${c.birthdate}）` : ""}
                    </span>
                  ))}
                </td>
                <td style={css.td}>{p.first_date}</td>
                <td style={css.td}>{p.last_date}</td>
                <td style={css.td}>{p.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
