// app/reserve/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

function nowJST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

type AvailResp = {
  ok: boolean;
  date: string;
  time?: string;
  closed: boolean;
  withinBookingWindow: boolean;
  canReserve: boolean;
  available?: Record<string, number>;
  message?: string;
};

export default function ReservePage() {
  // 表示対象日（当日 or 翌日）を JST の 12:00 で切り替え
  const now = nowJST();
  const hour = now.getHours();
  const targetDate = useMemo(() => {
    const base = new Date(now);
    if (hour >= 12) base.setDate(base.getDate() + 1);
    return ymd(base);
  }, [hour]);

  const [guardianName, setGuardianName] = useState("");
  const [email, setEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childBirthdate, setChildBirthdate] = useState(""); // YYYY-MM-DD
  const [time, setTime] = useState(""); // HH:MM
  const [checking, setChecking] = useState(false);
  const [canReserve, setCanReserve] = useState<boolean | null>(null);
  const [checkMsg, setCheckMsg] = useState<string>("");

  // 時刻が選ばれたら空き状況をチェック
  useEffect(() => {
    let abort = false;
    async function run() {
      if (!time) {
        setCanReserve(null);
        setCheckMsg("");
        return;
      }
      setChecking(true);
      setCheckMsg("空き状況を確認中…");
      try {
        const r = await fetch(
          `/api/availability?date=${encodeURIComponent(targetDate)}&time=${encodeURIComponent(time)}`,
          { cache: "no-store" }
        );
        const json: AvailResp = await r.json();
        if (abort) return;
        if (!json.ok) {
          setCanReserve(false);
          setCheckMsg(json.message ?? "予約不可");
        } else {
          setCanReserve(json.canReserve);
          setCheckMsg(
            json.canReserve
              ? "予約可能です"
              : json.closed
              ? "休園日/年末年始のため予約できません"
              : !json.withinBookingWindow
              ? "受付時間外のため予約できません"
              : "定員に達しています"
          );
        }
      } catch (e) {
        if (!abort) {
          setCanReserve(false);
          setCheckMsg("確認に失敗しました");
        }
      } finally {
        if (!abort) setChecking(false);
      }
    }
    run();
    return () => {
      abort = true;
    };
  }, [targetDate, time]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    // 軽いクライアント側バリデーション
    if (!guardianName || !email || !childName || !childBirthdate || !time) {
      alert("必須項目が未入力です。");
      return;
    }

    // 念のため送信直前にも可否チェック（レース条件対策）
    try {
      const pre = await fetch(
        `/api/availability?date=${encodeURIComponent(targetDate)}&time=${encodeURIComponent(time)}`,
        { cache: "no-store" }
      );
      const j: AvailResp = await pre.json();
      if (!j.ok || !j.canReserve) {
        alert(
          j.message ??
            (j.closed
              ? "休園日/年末年始のため予約できません。"
              : !j.withinBookingWindow
              ? "受付時間外のため予約できません。"
              : "現在この時間帯は予約できません。")
        );
        return;
      }
    } catch {
      // 失敗してもサーバ側で最終判定されるが、体験のため止める
      alert("空き状況の確認に失敗しました。時間をおいて再度お試しください。");
      return;
    }

    const payload = {
      guardian_name: guardianName,
      email,
      child_name: childName,
      child_birthdate: childBirthdate,
      preferred_date: targetDate,
      dropoff_time: time,
    };

    const res = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
      body: JSON.stringify(payload),
    });
    const json = await res.json();

    if (!res.ok || !json.ok) {
      alert(json.message ?? "送信に失敗しました。");
      return;
    }

    // 承認 or 保留の結果を表示
    if (json.status === "approved") {
      alert("受付完了（承認済）です。当日のご来室をお待ちしております。");
    } else {
      alert("受付完了（保留）です。先着超過のため承認までお待ちください。");
    }

    // 初期化
    setGuardianName("");
    setEmail("");
    setChildName("");
    setChildBirthdate("");
    setTime("");
    setCanReserve(null);
    setCheckMsg("");
  }

  // スマホ前提のシンプル freee 風 UI
  return (
    <main style={{ margin: "0 auto", padding: 16, maxWidth: 560 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, margin: "12px 0 8px" }}>病児保育 予約フォーム</h1>
      <p style={{ marginBottom: 12, lineHeight: 1.7 }}>
        {hour < 12 ? (
          <>
            現在は <strong>00:00〜12:00（当日のみ受付）</strong> です。
          </>
        ) : (
          <>
            現在は <strong>12:00〜24:00（翌日のみ受付）</strong> です。
          </>
        )}
        <br />
        <span style={{ color: "#6b7280" }}>
          ※ 翌日予約は<strong>正午12:00</strong>から可能です。
        </span>
      </p>

      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12 }}>
        <div style={box}>
          <div style={label}>利用日</div>
          <div style={{ fontWeight: 700 }}>{targetDate}</div>
          <div style={{ color: "#6b7280", fontSize: 12, marginTop: 4 }}>
            受付ルールにより当日または翌日のみ選択可能です
          </div>
        </div>

        <div style={box}>
          <label style={label}>
            預け希望時刻 <span style={req}>必須</span>
          </label>
          <input
            style={input}
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
          {time ? (
            <div style={{ fontSize: 12, marginTop: 6 }}>
              {checking ? "確認中…" : checkMsg}
              {canReserve === true && (
                <span style={{ marginLeft: 8, color: "#059669" }}>◯ 予約可能</span>
              )}
              {canReserve === false && (
                <span style={{ marginLeft: 8, color: "#b91c1c" }}>× 予約不可</span>
              )}
            </div>
          ) : null}
        </div>

        <div style={box}>
          <label style={label}>
            保護者氏名 <span style={req}>必須</span>
          </label>
          <input
            style={input}
            type="text"
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            required
            placeholder="山田 花子"
          />
        </div>

        <div style={box}>
          <label style={label}>
            連絡用メールアドレス <span style={req}>必須</span>
          </label>
          <input
            style={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="hanako@example.com"
            inputMode="email"
          />
        </div>

        <div style={box}>
          <label style={label}>
            お子さま氏名 <span style={req}>必須</span>
          </label>
          <input
            style={input}
            type="text"
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            required
            placeholder="山田 太郎"
          />
        </div>

        <div style={box}>
          <label style={label}>
            お子さま生年月日 <span style={req}>必須</span>
          </label>
          <input
            style={input}
            type="date"
            value={childBirthdate}
            onChange={(e) => setChildBirthdate(e.target.value)}
            required
            inputMode="numeric"
          />
        </div>

        <button style={button} type="submit" disabled={!time || checking}>
          予約を送信する
        </button>
      </form>
    </main>
  );
}

const box: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 10,
  padding: 12,
  background: "#fff",
};

const label: React.CSSProperties = {
  fontSize: 13,
  color: "#374151",
  marginBottom: 6,
  display: "block",
  fontWeight: 600,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 40,
  border: "1px solid #d1d5db",
  borderRadius: 8,
  padding: "0 12px",
  fontSize: 16,
};

const button: React.CSSProperties = {
  height: 44,
  background: "#2f7adf", // freee っぽいブルー
  color: "#fff",
  border: "none",
  borderRadius: 10,
  fontSize: 16,
  fontWeight: 700,
};

const req: React.CSSProperties = {
  color: "#dc2626",
  marginLeft: 6,
  fontSize: 12,
};
