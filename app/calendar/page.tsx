"use client";

import { useEffect, useMemo, useState } from "react";

type Avail = {
  ok: boolean;
  date: string;
  closed: boolean;                  // 休園（週末/祝日/年末年始）
  withinBookingWindow: boolean;     // 正午ルール内
  remaining: { daily: number; am: number; pm: number };
  canReserve: boolean;
  reason: "closed" | "window" | "full" | "period_full" | null;
};

type HolidayRes = { ok: boolean; date: string; holiday: boolean; info: { name: string } | null };

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
// 00:00–11:59 は当日 / 12:00–24:00 は翌日
function currentPreferredDate() {
  const n = nowJST();
  return n.getHours() < 12 ? ymd(n) : ymd(addDays(n, 1));
}

const styles: Record<string, React.CSSProperties> = {
  wrap: { maxWidth: 720, margin: "20px auto", padding: "0 14px" },
  h1: { fontSize: 20, fontWeight: 800, marginBottom: 10 },
  card: { background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16 },
  row: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  badge: { display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 },
  note: { fontSize: 12, color: "#475569", marginTop: 6, lineHeight: 1.7 },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 } as const,
  stat: { background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 10, padding: 12, textAlign: "center" },
  statNum: { fontSize: 22, fontWeight: 800 },
  btn: { height: 46, border: 0, borderRadius: 10, fontWeight: 700, fontSize: 16, background: "#00A5E2", color: "#fff", width: "100%" } as const,
  link: { textDecoration: "underline", color: "#334155", marginLeft: 12 },
};

export default function CalendarPage() {
  const date = useMemo(() => currentPreferredDate(), []);
  const [avail, setAvail] = useState<Avail | null>(null);
  const [hol, setHol] = useState<HolidayRes | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let dead = false;
    async function run() {
      setLoading(true);
      try {
        const [aRes, hRes] = await Promise.all([
          fetch(`/api/availability?date=${encodeURIComponent(date)}`, { cache: "no-store" }),
          fetch(`/api/debug/is-holiday?date=${encodeURIComponent(date)}`, { cache: "no-store" }),
        ]);
        const aJson = (await aRes.json()) as Avail;
        const hJson = (await hRes.json()) as HolidayRes;
        if (!dead) {
          setAvail(aJson);
          setHol(hJson?.ok ? hJson : { ok: true, date, holiday: false, info: null });
        }
      } catch {
        if (!dead) {
          setAvail(null);
          setHol({ ok: true, date, holiday: false, info: null });
        }
      } finally {
        if (!dead) setLoading(false);
      }
    }
    run();
    return () => { dead = true; };
  }, [date]);

  const badgeClosed = avail?.closed;
  const badgeWindow = avail && !avail.closed && !avail.withinBookingWindow;
  const badgeOpen = avail && avail.withinBookingWindow && !avail.closed;

  const badgeHoliday = hol?.holiday;
  const holidayName = hol?.info?.name || "祝日";

  return (
    <main style={styles.wrap}>
      <h1 style={styles.h1}>カレンダー</h1>

      <div style={styles.card}>
        <div style={styles.row}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{date}</div>

          {badgeHoliday && (
            <span style={{ ...styles.badge, background: "#FEF3C7", color: "#92400E" }}>
              祝日：{holidayName}
            </span>
          )}

          {badgeClosed && (
            <span style={{ ...styles.badge, background: "#FEE2E2", color: "#991B1B" }}>休園</span>
          )}

          {badgeWindow && (
            <span style={{ ...styles.badge, background: "#E5E7EB", color: "#374151" }}>受付時間外</span>
          )}

          {badgeOpen && !badgeClosed && (
            <span style={{ ...styles.badge, background: "#DCFCE7", color: "#065F46" }}>
              受付中
            </span>
          )}
        </div>

        <div style={styles.note}>
          前日昼12:00〜24:00は<strong>翌日</strong>のみ、深夜0:00〜昼12:00は<strong>当日</strong>のみ表示・受付します。<br />
          <strong>翌日予約は正午12:00から可能です。</strong>
        </div>

        {!loading && avail && (
          <>
            <div style={styles.grid}>
              <div style={styles.stat}>
                <div>本日の残り枠</div>
                <div style={styles.statNum}>{avail.remaining.daily}</div>
              </div>
              <div style={styles.stat}>
                <div>午前 / 午後</div>
                <div style={styles.statNum}>{avail.remaining.am} / {avail.remaining.pm}</div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", marginTop: 14 }}>
              <a href="/reserve" style={{ ...styles.btn, textAlign: "center", width: 220 }}>
                予約フォームへ
              </a>
              <a href="/admin" style={styles.link}>管理画面</a>
            </div>
          </>
        )}

        {loading && <div style={{ marginTop: 12, color: "#64748B" }}>読み込み中…</div>}
      </div>
    </main>
  );
}
