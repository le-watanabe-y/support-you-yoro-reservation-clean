// app/calendar/page.tsx
"use client";

function nowJST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" }));
}
function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function CalendarPage() {
  const now = nowJST();
  const hour = now.getHours();

  const today = ymd(now);
  const t = new Date(now);
  t.setDate(now.getDate() + 1);
  const tomorrow = ymd(t);

  const showDate = hour < 12 ? today : tomorrow;

  return (
    <main style={{ maxWidth: 640, margin: "24px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>予約カレンダー</h1>
      <p style={{ marginBottom: 8 }}>
        {hour < 12 ? "現在は 00:00〜11:59（当日のみ受付）です。" : "現在は 12:00〜24:00（翌日のみ受付）です。"}
      </p>
      <p style={{ marginBottom: 16, fontSize: 14, opacity: 0.8 }}>
        ※「翌日予約」は<strong>正午12:00</strong>から可能です。
      </p>
      <div style={{ padding: 12, border: "1px solid #ddd", borderRadius: 8 }}>
        <div>表示中の日付: <strong>{showDate}</strong></div>
      </div>
    </main>
  );
}
