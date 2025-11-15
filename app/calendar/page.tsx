"use client";
import React, { useEffect, useMemo, useState } from "react";

/** /api/availability の戻り型（必要な部分だけ） */
type AvailResp = {
  ok?: boolean;
  date?: string;
  closed?: boolean;
  withinBookingWindow?: boolean;
  canReserve?: boolean;
  limits?: { daily?: number | null; slot?: number | null } | null;
  counts?: { daily?: number | null; slot?: number | null } | null;
  message?: string;
};

const HOUR = 60 * 60 * 1000;
const JST_OFFSET = 9 * HOUR;

/** UTC Date -> JST視点（getUTC*でJSTの値が取れる） */
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
/** 「JSTの y-m-d hh:mm」を表すUTC Date */
function jstAt(ymd: string, hh = 0, mm = 0) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm, 0));
}
/** D-1 12:00 ～ D 12:00（JST）での受付状態（前/開/後） */
function windowStatus(ymd: string, now = new Date()) {
  const end = jstAt(ymd, 12, 0);            // D 12:00（排他）
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 1); // D-1 12:00
  const t = now.getTime();
  if (t < start.getTime()) return "before"; // 受付前
  if (t >= end.getTime()) return "after";   // 受付終了
  return "open";                             // 受付中
}

export default function Calendar() {
  const [ymd, setYmd] = useState<string>("");
  const [label, setLabel] = useState<"きょう" | "あす">("きょう");
  const [data, setData] = useState<AvailResp | null>(null);
  const [loading, setLoading] = useState(true);

  // ルール：
  // ・前日 12:00〜24:00（JST） → 翌日だけ表示
  // ・当日 00:00〜12:00（JST） → 当日だけ表示
  const ruleNote = "※ 翌日予約は正午12:00から可能です。";

  useEffect(() => {
    const now = new Date();
    const j = toJst(now);
    const hour = j.getUTCHours(); // JST の時（0-23）
    const today = ymdJst(now);
    const tomorrow = ymdJst(new Date(now.getTime() + 24 * HOUR));

    if (hour < 12) {
      setYmd(today);
      setLabel("きょう");
    } else {
      setYmd(tomorrow);
      setLabel("あす");
    }
  }, []);

  useEffect(() => {
    if (!ymd) return;
    setLoading(true);
    fetch(`/api/availability?date=${ymd}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [ymd]);

  const card: React.CSSProperties = useMemo(
    () => ({
      border: "1px solid #e5e7eb",
      background: "#fff",
      borderRadius: 12,
      padding: 16,
    }),
    []
  );

  function StatusBadge() {
    if (!ymd) return null;
    const ws = windowStatus(ymd);
    let text = "";
    let color = "#6b7280";

    if (data?.closed) {
      text = "休園日";
      color = "#991b1b";
    } else if (ws === "before") {
      text = "受付前（前日12:00から）";
    } else if (ws === "after") {
      text = "受付終了（当日12:00まで）";
    } else {
      // open
      if (data?.ok) {
        const limit = data?.limits?.daily ?? null;
        const used = data?.counts?.daily ?? null;
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
          text = data?.canReserve ? "受付中" : "受付不可";
          color = data?.canReserve ? "#065f46" : "#92400e";
        }
      } else {
        text = "状態を取得できませんでした";
        color = "#92400e";
      }
    }
    return (
      <span style={{ marginLeft: "auto", fontSize: 12, color }}>{text}</span>
    );
  }

  return (
    <main
      style={{
        padding: 16,
        maxWidth: 720,
        margin: "0 auto",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans JP', sans-serif",
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
        予約カレンダー（{label} のみ表示）
      </h1>
      <p style={{ color: "#6b7280", marginBottom: 4 }}>
        受付ウィンドウ：<strong>ご利用日前日12:00〜当日12:00（JST）</strong>
      </p>
      <p style={{ color: "#6b7280", marginBottom: 12 }}>{ruleNote}</p>

      {loading || !ymd ? (
        <div>読み込み中…</div>
      ) : (
        <div style={card}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <strong style={{ fontSize: 16 }}>{label}</strong>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{ymd}</span>
            <StatusBadge />
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
      )}
    </main>
  );
}
