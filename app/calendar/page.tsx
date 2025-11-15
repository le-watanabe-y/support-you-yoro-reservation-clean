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
  // 「JST の y-m-d hh:mm」を表す UTC Date を生成
  return new Date(Date.UTC(y, m - 1, d, hh - 9, mm, 0));
}
function windowStatus(ymd: string, now = new Date()) {
  // 受付ウィンドウ: D-1 12:00 ～ D 12:00（JST）
  const end = jstAt(ymd, 12, 0); // D 12:00（排他）
  const start = new Date(end.getTime());
  start.setUTCDate(start.getUTCDate() - 1); // D-1 12:00
  const t = now.getTime();
  if (t < start.getTime()) return "before"; // 受付前
  if (t >= end.getTime()) return "after";   // 受付終了
  return "open";                             // 受付中
}

export default function Calendar() {
  const [targetDate, setTargetDate] = useState<string>("");
  const [label, setLabel] = useState<"きょう" | "あす">("きょう");
  const [info, setInfo] = useState<string>("");
  const [avail, setAvail] = useState<AvailResp | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // JST の現在時刻で分岐
    const now = toJst(new Date());
    const hour = now.getUTCHours(); // JST に直した上での時間（0-23）
    const today = ymdJst(new Date());
    const tomorrow = ymdJst(new Date(Date.now() + 24 * HOUR));

    // ルール：
    // ・前日 12:00〜24:00 は翌日表示（hour >= 12）
    // ・当日 00:00〜12:00 は当日表示（hour < 12）
    if (hour >= 12) {
      setTargetDate(tomorrow);
      setLabel("あす");
      setInfo("翌日予約は正午12:00から可能です。（現在、翌日分を表示中）");
    } else {
      setTargetDate(today);
      setLabel("きょう");
      setInfo("翌日予約は正午12:00から可能です。（現在、当日分のみ表示中）");
    }
  }, []);

  useEffect(() => {
    if (!targetDate) return;
    setLoading(true);
    fetch(`/api/availability?date=${targetDate}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j: AvailResp) => setAvail(j))
      .catch(() => setAvail(null))
      .finally(() => setLoading(false));
  }, [targetDate]);

  const card: React.CSSProperties = {
    border: "1px solid #e5e7eb",
    background: "#fff",
    borderRadius: 12,
    padding: 16,
  };

  function StatusLine({ ymd }: { ymd: string }) {
    const ws = windowStatus(ymd);
    let text = "";
    let color = "#6b7280";

    if (!avail?.ok) {
      text = "状態を取得できませんでした";
      color = "#92400e";
    } else if (avail.closed) {
      text = "休園日";
      color = "#991b1b";
    } else if (ws === "before") {
      text = "受付前（前日12:00から）";
    } else if (ws === "after") {
      text = "受付終了（当日12:00まで）";
    } else {
      // open
      const limit = avail?.limits?.daily ?? null;
      const used = avail?.counts?.daily ?? null;
      if (limit != null && used != null) {
        const rest = Math.max(0, Number(limit) - Number(used));
        if (rest > 0 && avail?.canReserve) {
          text = `受付中（残り ${rest} 名）`;
          color = "#065f46";
        } else {
          text = "満員";
          color = "#92400e";
        }
      } else {
        // 予備
        text = avail?.canReserve ? "受付中" : "受付不可";
        color = avail?.canReserve ? "#065f46" : "#92400e";
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
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      }}
    >
      <h1 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
        予約カレンダー（対象日 1 件）
      </h1>

      {/* 案内メッセージ（常時） */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          background: "#f9fafb",
          color: "#374151",
          borderRadius: 12,
          padding: 12,
          fontSize: 13,
          marginBottom: 12,
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 4 }}>
          翌日予約は正午12:00から可能です。
        </div>
        <div style={{ color: "#6b7280" }}>{info}</div>
      </div>

      {loading || !targetDate ? (
        <div>読み込み中…</div>
      ) : (
        <div style={card}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 16 }}>{label}</strong>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{targetDate}</span>
            <StatusLine ymd={targetDate} />
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
              href={`/api/availability?date=${encodeURIComponent(targetDate)}`}
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
