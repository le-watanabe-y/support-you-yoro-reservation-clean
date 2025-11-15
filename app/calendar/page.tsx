"use client";

import { useEffect, useMemo, useState } from "react";

/** JST の現在日時を Date で返す（UTC ベースで+09:00補正） */
function nowJST(): Date {
  const now = new Date();
  // Date -> UTC -> JST(+9h)
  const utc = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utc + 9 * 60 * 60 * 1000);
}
function addDays(d: Date, days: number): Date {
  const nd = new Date(d);
  nd.setDate(nd.getDate() + days);
  return nd;
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${da}`;
}
type Avail = {
  date: string;
  closed: boolean;                 // 休園日 or 定休日
  withinBookingWindow: boolean;    // 受付ウィンドウ内か（時間帯ルール）
  canReserve: boolean;             // 予約可（定員・締切・休園 すべて含めて判定）
};

export default function CalendarPage() {
  const jstNow = nowJST();
  const hour = jstNow.getHours();

  // 仕様：
  // - 00:00〜11:59 は「当日」を表示
  // - 12:00〜23:59 は「翌日」を表示（前日正午〜当日0時は翌日予約のみ）
  const targetDate = useMemo(() => {
    const target = hour < 12 ? jstNow : addDays(jstNow, 1);
    return ymd(target);
  }, [hour, jstNow]);
  const targetLabel = hour < 12 ? "本日の受付状況" : "翌日の受付状況";

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Avail | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(`/api/availability?date=${targetDate}`, { cache: "no-store" });
        const json = await res.json();
        if (!res.ok) throw new Error(json?.message || "failed");
        if (!cancelled) setData(json as Avail);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message ?? "読み込みに失敗しました");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [targetDate]);

  return (
    <main style={styles.container}>
      <h1 style={styles.title}>予約カレンダー</h1>

      {/* 案内（常時表示） */}
      <p style={styles.notice}>
        <strong>翌日予約は正午12:00から可能です。</strong>
        <br />
        <span style={{ opacity: 0.8 }}>
          00:00〜11:59 は当日分、12:00〜24:00 は翌日分のみ表示されます（JST）。
        </span>
      </p>

      <section style={styles.card}>
        <div style={styles.cardHead}>
          <div style={styles.badge}>{targetLabel}</div>
          <div style={styles.dateText}>{targetDate}</div>
        </div>

        {loading && <p style={styles.muted}>読み込み中…</p>}
        {err && <p style={{ ...styles.muted, color: "#c00" }}>エラー：{err}</p>}

        {!loading && !err && data && (
          <>
            {data.closed ? (
              <div style={styles.row}>
                <span style={styles.tagGray}>休園日</span>
                <span style={styles.rowText}>本日は休園日のため予約できません。</span>
              </div>
            ) : (
              <>
                <div style={styles.row}>
                  <span style={data.withinBookingWindow ? styles.tagBlue : styles.tagGray}>
                    受付ウィンドウ
                  </span>
                  <span style={styles.rowText}>
                    {data.withinBookingWindow ? "受付時間内です" : "いまは受付時間外です"}
                  </span>
                </div>

                <div style={styles.row}>
                  <span style={data.canReserve ? styles.tagGreen : styles.tagRed}>
                    {data.canReserve ? "予約可" : "予約不可"}
                  </span>
                  <span style={styles.rowText}>
                    {data.canReserve
                      ? "フォームからお申し込みいただけます。"
                      : "定員/締切/休園等の条件により、現在はお申し込みできません。"}
                  </span>
                </div>
              </>
            )}

            <div style={{ marginTop: 16, fontSize: 12, color: "#667085" }}>
              ※ 受付ルールと定員はお知らせなく変更される場合があります。最新の状態は送信時に再判定されます。
            </div>
          </>
        )}
      </section>

      <nav style={styles.links}>
        <a href="/" style={styles.linkBtn}>フォームへ戻る</a>
        <a href="/admin" style={styles.linkBtn}>管理ページ</a>
      </nav>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: "16px",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Noto Sans JP, sans-serif",
    maxWidth: 720,
    margin: "0 auto",
  },
  title: { fontSize: 20, fontWeight: 700, margin: "4px 0 12px" },
  notice: {
    background: "#F2F4F7",
    border: "1px solid #EAECF0",
    borderRadius: 8,
    padding: "12px 14px",
    marginBottom: 12,
    lineHeight: 1.6,
    fontSize: 14,
  },
  card: {
    border: "1px solid #EAECF0",
    borderRadius: 12,
    padding: 16,
    background: "#fff",
  },
  cardHead: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  badge: {
    display: "inline-block",
    padding: "4px 8px",
    borderRadius: 999,
    background: "#EEF4FF",
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: 700,
  },
  dateText: { marginLeft: "auto", fontSize: 14, color: "#667085" },
  row: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 },
  rowText: { fontSize: 14, color: "#101828" },
  tagBlue: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 6,
    background: "#E0EAFF",
    color: "#1D4ED8",
    fontSize: 12,
    fontWeight: 700,
    minWidth: 88,
    textAlign: "center",
  },
  tagGreen: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 6,
    background: "#D1FADF",
    color: "#027A48",
    fontSize: 12,
    fontWeight: 700,
    minWidth: 88,
    textAlign: "center",
  },
  tagRed: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 6,
    background: "#FFE4E6",
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: 700,
    minWidth: 88,
    textAlign: "center",
  },
  tagGray: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 6,
    background: "#F2F4F7",
    color: "#667085",
    fontSize: 12,
    fontWeight: 700,
    minWidth: 88,
    textAlign: "center",
  },
  muted: { color: "#667085", fontSize: 14 },
  links: {
    display: "flex",
    gap: 8,
    marginTop: 16,
  },
  linkBtn: {
    border: "1px solid #EAECF0",
    padding: "8px 12px",
    borderRadius: 8,
    textDecoration: "none",
    color: "#111827",
    background: "#fff",
  },
};
