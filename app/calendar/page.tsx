"use client";
import React, { useEffect, useState } from "react";

type AvailResp = {
  ok: boolean;
  date: string;
  closed?: boolean;
  withinBookingWindow?: boolean;
  canReserve?: boolean;
  limits?: { daily: number | null; slot: number | null } | null;
  counts?: { daily: number | null; slot: number | null } | null;
};

const HOUR = 60 * 60 * 1000;
const JST_OFFSET = 9 * HOUR;

function toJst(d: Date) {
  return new Date(d.getTime() + JST_OFFSET);
}
function ymdJst(d: Date) {
  const j = toJst(d);
  const y = j.getUTCFullYear();
  const m = String(j.getUTCMonth() + 1).padStart(2, "0");
  const day = String(j.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function jstAt(ymd: string, hh = 0, mm = 0) {
  const [y, m, d] = ymd.split("-").map(Number);
  // 「JSTの y-m-d hh:mm」を表す UTC Date を作る（Nextサーバと整合）
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm, 0));
}
function windowStatus(ymd: string, now = new Date()) {
  const end = jstAt(ymd, 12, 0); // D 12:00（排他的）
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 1); // D-1 12:00
  const t = now.getTime();
  if (t < start.getTime()) return "before"; // 受付前
  if (t >= end.getTime()) return "after";   // 受付終了
  return "open";                             // 受付中
}

export default function Calendar() {
  const [today, setToday] = useState("");
  const [tomorrow, setTomorrow] = useState("");
  const [data, setData] = useState<Record<string, AvailResp | null>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const t = ymdJst(now);
    const tm = ymdJst(new Date(now.getTime() + 24 * HOUR));
    setToday(t);
    setTomorrow(tm);

    Promise.all(
      [t, tm].map(async (d) => {
        const res = await fetch(`/api/availability?date=${d}`, { cache: "no-store" });
        const json = (await res.json()) as AvailResp;
        return [d, json] as const;
      })
    )
      .then((entries) => {
        const obj: Record<string, AvailResp> = {};
        for (const [d, j] of entries) obj[d] = j;
        setData(obj);
      })
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, []);

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: 16,
  };

  function Row({ label, ymd }: { label: string; ymd: string }) {
    const a = data[ymd];
    const ws = windowStatus(ymd);
    let text = "";
    let color = "#6b7280";

    if (a?.closed) {
      text = "休園日";
      color = "#991b1b";
    } else if (ws === "before") {
      text = "受付前（前日12:00から）";
    } else if (ws === "after") {
      text = "受付終了（当日12:00まで）";
    } else {
      // open
      if (a?.ok) {
        const limit = a?.limits?.daily ?? null;
        const used = a?.counts?.daily ?? null;
        if (limit != null && used != null) {
          const rest = Math.max(0, Number(limit) - Number(used));
          if (rest > 0) {
            text = `受付中（残り ${rest} 名）`;
            color = "#065f46";
          } else {
            text = "満員";
            color = "#92400e";
          }
        } else {
          text = a?.canReserve ? "受付中" : "受付不可";
          color = a?.canReserve ? "#065f46" : "#92400e";
        }
      } else {
        text = "状態を取得できませんでした";
        color = "#92400e";
      }
    }

    return (
      <div style={card}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
          <strong style={{ fontSize: 16 }}>{label}</strong>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{ymd}</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color }}>{text}</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a
            href="/"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              background: "#111827",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            この日で申込（フォームへ）
          </a>
          <a
            href={`/api/availability?date=${encodeURIComponent(ymd)}`}
            target="_blank"
            rel="noreferrer"
            style={{
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #e5e7eb",
              textDecoration: "none",
              color: "#111827",
            }}
          >
            詳細JSONを見る
          </a>
        </div>
      </div>
    );
  }

  return (
    <main
      style={{
        padding: 16,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        予約カレンダー（きょう・あす）
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 12 }}>
        受付ウィンドウ：<strong>ご利用日前日12:00〜当日12:00（JST）</strong>
      </p>

      {loading ? (
        <div>読み込み中…</div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {today && <Row label="きょう" ymd={today} />}
          {tomorrow && <Row label="あす" ymd={tomorrow} />}
        </div>
      )}
    </main>
  );
}
