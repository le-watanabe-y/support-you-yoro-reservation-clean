// app/reserve/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";

// ---- 時刻プルダウン（必要に応じて範囲/刻みを変更） ----
function generateTimes(start = "08:00", end = "18:00", stepMin = 30): string[] {
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  };
  const pad = (n: number) => String(n).padStart(2, "0");
  const toHHMM = (m: number) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
  const out: string[] = [];
  for (let m = toMin(start); m <= toMin(end); m += stepMin) out.push(toHHMM(m));
  return out;
}
const TIME_OPTIONS = generateTimes("08:00", "18:00", 30);

// ---- JSTユーティリティ ----
function nowJST(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
// 正午ルール：00:00–11:59 は当日、12:00–24:00 は翌日
function currentPreferredDate(): string {
  const n = nowJST();
  return n.getHours() < 12 ? ymd(n) : ymd(addDays(n, 1));
}

// ---- 型 ----
type AvailJSON = {
  ok: boolean;
  date: string;
  time?: string | null;
  period?: "am" | "pm" | null;
  closed: boolean;
  withinBookingWindow: boolean;
  canReserve: boolean;
  daily: { used: number; limit: number; remaining: number };
  period: null | { key: "am" | "pm"; used: number; limit: number; remaining: number };
  message?: string;
};

export default function ReservePage() {
  const preferredDate = useMemo(() => currentPreferredDate(), []);
  const [guardianName, setGuardianName] = useState("");
  const [email, setEmail] = useState("");
  const [childName, setChildName] = useState("");
  const [childBirthdate, setChildBirthdate] = useState("");
  const [dropoffTime, setDropoffTime] = useState(TIME_OPTIONS[0]);

  const [checking, setChecking] = useState(false);
  const [availability, setAvailability] = useState<AvailJSON | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // 初期値：現在時刻に近い値を候補に（任意）
  useEffect(() => {
    const n = nowJST();
    const hh = String(n.getHours()).padStart(2, "0");
    const mm = n.getMinutes() < 30 ? "00" : "30";
    const close = `${hh}:${mm}`;
    const found = TIME_OPTIONS.find((t) => t >= close);
    if (found) setDropoffTime(found);
  }, []);

  // 選択した時刻で空き状況を確認
  useEffect(() => {
    let abort = false;
    async function run() {
      if (!dropoffTime) {
        setAvailability(null);
        return;
      }
      setChecking(true);
      setMessage(null);
      try {
        const r = await fetch(
          `/api/availability?date=${encodeURIComponent(preferredDate)}&time=${encodeURIComponent(dropoffTime)}`,
          { cache: "no-store" }
        );
        const json: AvailJSON = await r.json();
        if (abort) return;
        if (!json.ok) {
          setAvailability(null);
          setMessage(json.message ?? "空き状況の取得に失敗しました");
        } else {
          setAvailability(json);
        }
      } catch (e: any) {
        if (!abort) {
          setAvailability(null);
          setMessage("空き状況の取得に失敗しました");
        }
      } finally {
        if (!abort) setChecking(false);
      }
    }
    run();
    return () => {
      abort = true;
    };
  }, [preferredDate, dropoffTime]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);

    // 直前チェック（UIとAPIのタイムラグ対策）
    try {
      const res = await fetch(
        `/api/availability?date=${encodeURIComponent(preferredDate)}&time=${encodeURIComponent(dropoffTime)}`,
        { cache: "no-store" }
      );
      const j: AvailJSON = await res.json();
      if (!j.ok || !j.canReserve) {
        setSubmitting(false);
        const reason =
          j?.closed
            ? "休園日のため予約できません。"
            : !j?.withinBookingWindow
            ? "受付時間外のため予約できません。"
            : "現在この時間帯は満席です。";
        alert(reason);
        return;
      }
    } catch {
      setSubmitting(false);
      alert("空き状況の確認に失敗しました。時間をおいて再度お試しください。");
      return;
    }

    const payload = {
      guardianName,
      email,
      childName,
      childBirthdate: childBirthdate || null,
      preferredDate,
      dropoffTime,
    };

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.ok) {
        setMessage(json?.message || "送信に失敗しました");
      } else {
        setMessage(
          json?.status === "approved"
            ? "受付完了：承認済み（先着枠）"
            : "受付完了：待機（承認までお待ちください）"
        );
        // 初期化
        setGuardianName("");
        setEmail("");
        setChildName("");
        setChildBirthdate("");
      }
    } catch (err: any) {
      setMessage(err?.message || "送信エラーが発生しました");
    } finally {
      setSubmitting(false);
    }
  }

  const noonHint =
    "前日12:00〜24:00は翌日分のみ、00:00〜12:00は当日分のみ受付です（翌日予約は正午12:00から可能）。";

  // 表示用：空きメッセージ
  const availText = useMemo(() => {
    const a = availability;
    if (!a) return "";
    if (checking) return "空き状況を確認中…";
    if (a.closed) return "休園日のため予約不可";
    if (!a.withinBookingWindow) return "受付時間外のため予約不可";
    const daily = `本日残り ${a.daily.remaining}/${a.daily.limit}`;
    const slot =
      a.period && a.period.remaining != null
        ? ` / この時間帯 残り ${a.period.remaining}/${a.period.limit}`
        : "";
    return `${a.canReserve ? "予約可能" : "満席"}：${daily}${slot}`;
  }, [availability, checking]);

  return (
    <main style={styles.wrap}>
      <h1 style={styles.h1}>病児保育 予約</h1>

      <div style={styles.notice}>
        <div>
          <strong>対象日：</strong>
          <span style={{ fontWeight: 700 }}>{preferredDate}</span>
        </div>
        <div style={{ fontSize: 13, color: "#4b5563", marginTop: 4 }}>{noonHint}</div>
      </div>

      <form onSubmit={onSubmit} style={styles.form}>
        <label style={styles.label}>
          保護者氏名（必須）
          <input
            style={styles.input}
            value={guardianName}
            onChange={(e) => setGuardianName(e.target.value)}
            required
            placeholder="山田 太郎"
          />
        </label>

        <label style={styles.label}>
          メールアドレス（必須）
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="example@example.com"
            inputMode="email"
            type="email"
          />
        </label>

        <label style={styles.label}>
          お子さま氏名
          <input
            style={styles.input}
            value={childName}
            onChange={(e) => setChildName(e.target.value)}
            placeholder="山田 花子"
          />
        </label>

        <label style={styles.label}>
          お子さま生年月日
          <input
            style={styles.input}
            value={childBirthdate}
            onChange={(e) => setChildBirthdate(e.target.value)}
            type="date"
            placeholder="YYYY-MM-DD"
          />
        </label>

        <label style={styles.label}>
          預け希望時刻（必須 / プルダウン）
          <select
            style={styles.select}
            value={dropoffTime}
            onChange={(e) => setDropoffTime(e.target.value)}
            required
          >
            {TIME_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          {/* 空き状況 */}
          {dropoffTime && (
            <div style={{ fontSize: 12, marginTop: 6, color: availability?.canReserve ? "#065f46" : "#b91c1c" }}>
              {availText}
            </div>
          )}
        </label>

        <button type="submit" disabled={submitting || checking} style={styles.submit}>
          {submitting ? "送信中…" : "予約を送信"}
        </button>

        {message && <p style={styles.message}>{message}</p>}
      </form>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrap: {
    maxWidth: 560,
    margin: "24px auto",
    padding: "16px",
  },
  h1: {
    fontSize: 20,
    fontWeight: 800,
    marginBottom: 12,
  },
  notice: {
    background: "#F0F9FF",
    border: "1px solid #BAE6FD",
    borderRadius: 12,
    padding: "12px 14px",
    marginBottom: 16,
  },
  form: {
    display: "grid",
    gap: 14,
  },
  label: {
    display: "grid",
    gap: 6,
    fontSize: 14,
    fontWeight: 600,
  },
  input: {
    height: 44,
    padding: "0 12px",
    fontSize: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    outline: "none",
  },
  select: {
    height: 44,
    padding: "0 12px",
    fontSize: 16,
    border: "1px solid #e5e7eb",
    borderRadius: 10,
    outline: "none",
    background: "#fff",
  },
  submit: {
    height: 48,
    background: "#00A5E2",
    color: "#fff",
    border: 0,
    borderRadius: 12,
    fontWeight: 700,
    fontSize: 16,
  },
  message: {
    marginTop: 8,
    color: "#0F766E",
    fontWeight: 700,
  },
};
