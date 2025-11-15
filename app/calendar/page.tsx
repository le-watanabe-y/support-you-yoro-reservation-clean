"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

type Avail = {
  ok: boolean;
  date: string;
  closed: boolean;
  withinBookingWindow?: boolean;
  canReserve?: boolean;
};

type Holiday = {
  ok: boolean;
  holiday: boolean;
  name?: string;
};

function nowJST(): Date {
  // クライアント側でJST現在時刻
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" })
  );
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function decideTargetDate(): string {
  const n = nowJST();
  return n.getHours() < 12 ? ymd(n) : ymd(addDays(n, 1));
}

const badge = (label: string, tone: "red" | "green" | "blue" | "gray") => {
  const toneMap: Record<string, string> = {
    red: "#fee2e2",
    green: "#dcfce7",
    blue: "#e0f2fe",
    gray: "#f3f4f6",
  };
  const borderMap: Record<string, string> = {
    red: "#fecaca",
    green: "#bbf7d0",
    blue: "#bae6fd",
    gray: "#e5e7eb",
  };
  const colorMap: Record<string, string> = {
    red: "#b91c1c",
    green: "#065f46",
    blue: "#075985",
    gray: "#374151",
  };
  return {
    background: toneMap[tone],
    border: `1px solid ${borderMap[tone]}`,
    color: colorMap[tone],
    fontWeight: 700,
    padding: "4px 10px",
    borderRadius: 9999,
    fontSize: 12,
  } as React.CSSProperties;
};

export default function CalendarPage() {
  const sp = useSearchParams();
  const override = sp.get("date") || sp.get("debug"); // デバッグ用
  const [date, setDate] = useState<string>(override || decideTargetDate());
  const [avail, setAvail] = useState<Avail | null>(null);
  const [hol, setHol] = useState<Holiday | null>(null);
  const [loading, setLoading] = useState(true);

  // 正午ルールに従い、初回表示日を決定
  useEffect(() => {
    if (!override) setDate(decideTargetDate());
  }, [override]);

  // API取得
  useEffect(() => {
    let alive = true;
    async function load() {
      setLoading(true);
      try {
        const a = await fetch(`/api/availability?date=${date}`, { cache: "no-store" });
        const aj = (await a.json()) as Avail;
        const h = await fetch(`/api/debug/is-holiday?date=${date}`, { cache: "no-store" });
        const hj = h.ok ? ((await h.json()) as Holiday) : { ok: true, holiday: false };

        if (alive) {
          setAvail(aj);
          setHol(hj);
        }
      } catch {
        if (alive) {
          setAvail({ ok: false, date, closed: false });
          setHol({ ok: false, holiday: false });
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    load();
    return () => {
      alive = false;
    };
  }, [date]);

  const noonHint =
    "前日12:00〜24:00は翌日分のみ、00:00〜12:00は当日分のみ表示（翌日予約は正午12:00から可能）。";

  const holidayName = hol?.holiday ? hol?.name || "祝日" : null;
  const closed = !!avail?.closed;
  const canReserve = !!avail?.canReserve;

  return (
    <main style={{ maxWidth: 720, margin: "24px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>
        予約カレンダー
      </h1>

      <section
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 16,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <div style={{ fontWeight: 800, fontSize: 18 }}>{date}</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/* 祝日バッジ */}
            {holidayName && <span style={badge(`祝日：${holidayName}`, "blue")} />}
            {/* 休園/開園バッジ */}
            {closed ? (
              <span style={badge("休園日", "red")} />
            ) : (
              <span style={badge("開園日", "green")} />
            )}
          </div>
        </div>

        <p style={{ color: "#4b5563", fontSize: 13 }}>{noonHint}</p>

        <div style={{ marginTop: 16 }}>
          {loading && <p>読込中…</p>}
          {!loading && (
            <>
              {closed ? (
                <p style={{ color: "#b91c1c", fontWeight: 700 }}>
                  本日は休園日のため予約できません。
                </p>
              ) : canReserve ? (
                <p style={{ color: "#065f46", fontWeight: 700 }}>予約可能です。</p>
              ) : (
                <p style={{ color: "#92400e", fontWeight: 700 }}>
                  現在は受付時間外です（正午ルール）。
                </p>
              )}
            </>
          )}
        </div>

        <div style={{ marginTop: 16, display: "flex", gap: 8 }}>
          <a
            href="/reserve"
            style={{
              height: 44,
              background: "#00A5E2",
              color: "#fff",
              border: 0,
              borderRadius: 10,
              fontWeight: 700,
              padding: "0 16px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            予約フォームへ
          </a>
          <a
            href={`/api/availability?date=${date}`}
            style={{ alignSelf: "center", textDecoration: "underline", fontSize: 13 }}
          >
            API（可否を確認）
          </a>
        </div>
      </section>

      {/* デバッグメモ（必要なければ削除可） */}
      <details style={{ marginTop: 16 }}>
        <summary style={{ cursor: "pointer" }}>デバッグ情報</summary>
        <pre style={{ fontSize: 12, background: "#f9fafb", padding: 12, overflow: "auto" }}>
{JSON.stringify({ avail, hol }, null, 2)}
        </pre>
      </details>
    </main>
  );
}
