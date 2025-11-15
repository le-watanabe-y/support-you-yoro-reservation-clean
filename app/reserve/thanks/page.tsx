"use client";
import { useSearchParams, useRouter } from "next/navigation";

export default function ThanksPage() {
  const q = useSearchParams();
  const router = useRouter();
  const status = q.get("status") || "pending";

  return (
    <main style={{ maxWidth: 560, margin: "24px auto", padding: 16 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>予約を受け付けました</h1>
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "#fff" }}>
        <p style={{ lineHeight: 1.8 }}>
          現在のステータス：{" "}
          <strong style={{ color: status === "approved" ? "#059669" : "#b45309" }}>
            {status === "approved" ? "承認済（先着枠）" : "保留（承認までお待ちください）"}
          </strong>
        </p>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 8 }}>
          ※「翌日予約は正午12:00から可能です」。メール控えも送信しています（環境により届かない場合があります）。
        </p>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button
          onClick={() => router.push("/reserve")}
          style={{ height: 44, background: "#00A5E2", color: "#fff", border: 0, borderRadius: 10, fontWeight: 700, padding: "0 16px" }}
        >
          もう一件予約する
        </button>
        <a href="/calendar" style={{ alignSelf: "center", textDecoration: "underline" }}>カレンダーへ戻る</a>
      </div>
    </main>
  );
}
