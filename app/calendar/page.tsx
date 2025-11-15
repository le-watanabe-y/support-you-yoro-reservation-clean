// app/calendar/page.tsx
import Link from "next/link";

function nowInJST(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
  return new Date(s);
}
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarPage() {
  const now = nowInJST();
  const hour = now.getHours();               // JST 時
  const show = new Date(now);
  if (hour >= 12) show.setDate(show.getDate() + 1); // 12:00～は翌日表示

  const isTomorrow = hour >= 12;
  const dateStr = ymd(show);

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>予約カレンダー</h1>

      <div style={{
        border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, background: "#fff",
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)", marginBottom: 16
      }}>
        <p style={{ margin: "0 0 8px", color: "#374151" }}>
          表示中の予約日：<b>{dateStr}</b>
        </p>
        <p style={{ margin: 0, color: "#6b7280", lineHeight: 1.6 }}>
          {isTomorrow
            ? "現在は前日12:00〜24:00の時間帯のため、翌日の予約のみ受付中です。"
            : "現在は0:00〜12:00の時間帯のため、当日の予約のみ受付中です。"}
          <br />
          <b>翌日予約は正午12時から可能です。</b>
        </p>
      </div>

      <Link
        href="/"
        style={{
          display: "inline-block", padding: "10px 14px", borderRadius: 8,
          background: "#16a34a", color: "#fff", textDecoration: "none", fontWeight: 600
        }}
      >
        フォームへ進む
      </Link>
    </main>
  );
}
