"use client";

import { useEffect, useMemo, useState } from "react";

/** ---------- types ---------- */
type Status = "pending" | "approved" | "rejected" | "canceled";

type Row = {
  id: string;
  status: Status;
  preferred_date: string;   // YYYY-MM-DD
  dropoff_time: string;     // HH:MM
  guardian_name: string;
  email: string;
  child_name?: string | null;
  child_birthdate?: string | null;
  created_at: string;
};

type Avail = {
  ok: boolean;
  date: string;
  closed: boolean;
  withinBookingWindow: boolean;
  remaining: { daily: number; am: number; pm: number };
  canReserve: boolean;
};

/** ---------- JST utils ---------- */
function nowJST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
const todayStr = () => ymd(nowJST());
const tomorrowStr = () => ymd(addDays(nowJST(), 1));

/** ---------- fetchers ---------- */
async function getAvailability(date: string): Promise<Avail | null> {
  try {
    const r = await fetch(`/api/availability?date=${encodeURIComponent(date)}`, { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as Avail;
  } catch {
    return null;
  }
}
async function getReservations(): Promise<Row[]> {
  const r = await fetch("/api/reservations", { cache: "no-store" });
  const j = await r.json();
  return (j?.items ?? []) as Row[];
}
async function patchStatus(id: string, status: Status) {
  const r = await fetch(`/api/admin/reservations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(t || "failed to update");
  }
}

/** ---------- styles ---------- */
const css: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 980, margin: "22px auto", padding: "0 16px" },
  h1: { fontSize: 20, fontWeight: 800, marginBottom: 12 },

  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 } as const,
  cap: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 14 },
  capTitle: { fontSize: 12, color: "#334155", marginBottom: 6 },
  capMain: { display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" },
  capNum: { fontSize: 22, fontWeight: 800 },
  badge: { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 },

  toolbar: { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: 10, marginBottom: 10 },
  row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  chip: (active: boolean): React.CSSProperties => ({
    height: 32, padding: "0 12px", borderRadius: 999, border: active ? "1px solid #0284C7" : "1px solid #CBD5E1",
    background: active ? "#E0F2FE" : "#fff", color: active ? "#075985" : "#334155", fontWeight: 700, cursor: "pointer"
  }),
  pill: (active: boolean): React.CSSProperties => ({
    height: 32, padding: "0 10px", borderRadius: 999, border: active ? "1px solid #16A34A" : "1px solid #CBD5E1",
    background: active ? "#DCFCE7" : "#fff", color: active ? "#065F46" : "#334155", fontWeight: 700, cursor: "pointer"
  }),
  select: { height: 34, border: "1px solid #CBD5E1", borderRadius: 8, padding: "0 8px" },
  input: { height: 34, border: "1px solid #CBD5E1", borderRadius: 8, padding: "0 10px", minWidth: 200 },

  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, overflow: "hidden" },
  th: { textAlign: "left", background: "#F8FAFC", padding: "10px 12px", fontSize: 12, color: "#475569", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" },
  td: { padding: "10px 12px", fontSize: 14, borderBottom: "1px solid #F1F5F9" },
  small: { fontSize: 12, color: "#64748B" },
  statusPill: (c: string, bg: string): React.CSSProperties => ({ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: c, background: bg }),
  btnRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  btn: { height: 34, padding: "0 10px", border: "1px solid #CBD5E1", borderRadius: 8, background: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer" } as const,
};

/** ---------- helpers ---------- */
function toMin(hhmm: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return 0;
  return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

export default function AdminPage() {
  const today = useMemo(todayStr, []);
  const tomorrow = useMemo(tomorrowStr, []);

  const [aToday, setAToday] = useState<Avail | null>(null);
  const [aTomorrow, setATomorrow] = useState<Avail | null>(null);
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // フィルタ・ソート状態
  type DateTab = "today" | "tomorrow" | "all";
  const [tab, setTab] = useState<DateTab>("all");
  const [q, setQ] = useState("");
  const [statusOn, setStatusOn] = useState<Record<Status, boolean>>({
    approved: true, pending: true, rejected: false, canceled: false,
  });
  type SortKey = "created_desc" | "created_asc" | "date_asc" | "date_desc" | "time_asc" | "time_desc";
  const [sort, setSort] = useState<SortKey>("created_desc");

  async function loadAll() {
    setLoading(true);
    try {
      const [r1, r2, r3] = await Promise.all([getAvailability(today), getAvailability(tomorrow), getReservations()]);
      setAToday(r1); setATomorrow(r2); setItems(r3);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadAll(); }, []);

  async function setStatus(id: string, status: Status) {
    await patchStatus(id, status);
    await loadAll();
  }

  // フィルタ→並べ替え
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    let arr = items.filter(r => statusOn[r.status]); // status filter
    if (tab === "today") arr = arr.filter(r => r.preferred_date === today);
    if (tab === "tomorrow") arr = arr.filter(r => r.preferred_date === tomorrow);
    if (s) {
      arr = arr.filter(r =>
        (r.guardian_name ?? "").toLowerCase().includes(s) ||
        (r.email ?? "").toLowerCase().includes(s) ||
        (r.child_name ?? "").toLowerCase().includes(s) ||
        (r.preferred_date ?? "").toLowerCase().includes(s)
      );
    }
    const byDate = (a: Row, b: Row) => a.preferred_date.localeCompare(b.preferred_date);
    const byCreated = (a: Row, b: Row) => a.created_at.localeCompare(b.created_at);
    const byTime = (a: Row, b: Row) => toMin(a.dropoff_time) - toMin(b.dropoff_time);

    switch (sort) {
      case "created_desc": return arr.sort((a,b)=> byCreated(b,a));
      case "created_asc": return arr.sort(byCreated);
      case "date_asc": return arr.sort((a,b)=> byDate(a,b) || byTime(a,b));
      case "date_desc": return arr.sort((a,b)=> byDate(b,a) || byTime(b,a));
      case "time_asc": return arr.sort((a,b)=> byTime(a,b));
      case "time_desc": return arr.sort((a,b)=> byTime(b,a));
      default: return arr;
    }
  }, [items, q, tab, statusOn, sort, today, tomorrow]);

  function CapCard({ label, a }: { label: string; a: Avail | null }) {
    const pill = a?.closed
      ? { text: "休園", style: { ...css.badge, background: "#FEE2E2", color: "#991B1B" } }
      : a && !a.withinBookingWindow
      ? { text: "受付時間外", style: { ...css.badge, background: "#E5E7EB", color: "#374151" } }
      : { text: "受付中", style: { ...css.badge, background: "#DCFCE7", color: "#065F46" } };

    return (
      <div style={css.cap}>
        <div style={css.capTitle}>{label}</div>
        <div style={css.capMain}>
          <span style={pill.style as React.CSSProperties}>{pill.text}</span>
          <span style={css.capNum}>{a?.remaining?.daily ?? "-"}</span>
          <span style={{ ...css.small, marginLeft: 6 }}>名（AM {a?.remaining?.am ?? "-"} / PM {a?.remaining?.pm ?? "-" }）</span>
      </div>
      </div>
    );
  }

  function StatusPill({ s }: { s: Status }) {
    if (s === "approved") return <span style={css.statusPill("#065F46", "#DCFCE7")}>承認</span>;
    if (s === "pending") return <span style={css.statusPill("#92400E", "#FEF3C7")}>保留</span>;
    if (s === "rejected") return <span style={css.statusPill("#991B1B", "#FEE2E2")}>却下</span>;
    return <span style={css.statusPill("#334155", "#E2E8F0")}>キャンセル</span>;
  }

  return (
    <main style={css.wrap}>
      <h1 style={css.h1}>管理</h1>

      {/* 残枠サマリー */}
      <div style={css.grid2}>
        <CapCard label={`今日（${today}）`} a={aToday} />
        <CapCard label={`明日（${tomorrow}）`} a={aTomorrow} />
      </div>

      {/* ツールバー：日付タブ / ステータスフィルタ / 並べ替え / 検索 */}
      <div style={css.toolbar}>
        <div style={css.row}>
          {/* 日付タブ */}
          {(["all","today","tomorrow"] as const).map(t => (
            <button key={t} onClick={()=>setTab(t)} style={css.chip(tab===t)}>
              {t==="all"?"すべて": t==="today"?"今日":"明日"}
            </button>
          ))}

          {/* ステータスフィルタ */}
          {(["approved","pending","rejected","canceled"] as const).map(st => (
            <button key={st}
              onClick={()=> setStatusOn(prev=> ({...prev, [st]: !prev[st]}))}
              style={css.pill(statusOn[st])}
            >
              {st==="approved"?"承認":st==="pending"?"保留":st==="rejected"?"却下":"キャンセル"}
            </button>
          ))}

          {/* 並べ替え */}
          <select value={sort} onChange={e=>setSort(e.target.value as any)} style={css.select}>
            <option value="created_desc">作成日時（新しい順）</option>
            <option value="created_asc">作成日時（古い順）</option>
            <option value="date_asc">利用日（早い順）</option>
            <option value="date_desc">利用日（遅い順）</option>
            <option value="time_asc">時刻（早い順）</option>
            <option value="time_desc">時刻（遅い順）</option>
          </select>

          {/* 検索 */}
          <input
            style={css.input}
            placeholder="保護者・メール・お子さま・日付で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <button style={css.btn} onClick={loadAll}>再読込</button>
        </div>
      </div>

      {/* 一覧 */}
      <div style={css.tableWrap}>
        <table style={css.table}>
          <thead>
            <tr>
              <th style={css.th}>受付</th>
              <th style={css.th}>日付 / 時刻</th>
              <th style={css.th}>保護者 / 連絡</th>
              <th style={css.th}>お子さま</th>
              <th style={css.th}>ステータス</th>
              <th style={css.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td style={css.td} colSpan={6}>読み込み中…</td></tr>}
            {!loading && filtered.length === 0 && <tr><td style={css.td} colSpan={6}>該当なし</td></tr>}
            {!loading && filtered.map((r) => (
              <tr key={r.id}>
                <td style={css.td}>
                  <div style={css.small}>{new Date(r.created_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</div>
                </td>
                <td style={css.td}>
                  <div><strong>{r.preferred_date}</strong></div>
                  <div style={css.small}>{r.dropoff_time}</div>
                </td>
                <td style={css.td}>
                  <div><strong>{r.guardian_name}</strong></div>
                  <div style={css.small}>{r.email}</div>
                </td>
                <td style={css.td}>
                  <div>{r.child_name || "（未入力）"}</div>
                </td>
                <td style={css.td}><StatusPill s={r.status} /></td>
                <td style={css.td}>
                  <div style={css.btnRow}>
                    <button style={css.btn} onClick={() => setStatus(r.id, "approved")}>承認</button>
                    <button style={css.btn} onClick={() => setStatus(r.id, "pending")}>保留</button>
                    <button style={css.btn} onClick={() => setStatus(r.id, "rejected")}>却下</button>
                    <button style={css.btn} onClick={() => setStatus(r.id, "canceled")}>キャンセル</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ height: 14 }} />
      <div style={css.small}>
        スマホ前提：テーブルは横スクロール対応。フィルタ・並べ替え・検索は組み合わせ可。
      </div>
    </main>
  );
}
