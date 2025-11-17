"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function ThanksClient() {
  const sp = useSearchParams();
  const id = sp.get("id") ?? "";
  const status = sp.get("status") ?? "pending";

  const title =
    status === "approved"
      ? "予約が確定しました"
      : status === "pending"
      ? "予約を受け付けました"
      : status === "rejected"
      ? "予約は承認されませんでした"
      : "送信が完了しました";

  return (
    <>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 12 }}>{title}</h1>
      {id && (
        <p style={{ opacity: 0.8 }}>
          受付番号: <strong>{id}</strong>
        </p>
      )}
      <p style={{ marginTop: 8, opacity: 0.8 }}>
        結果はメールでもご案内します。管理画面からも確認できます。
      </p>
      <div style={{ marginTop: 24 }}>
        <Link href="/" style={{ textDecoration: "underline" }}>
          トップへ戻る
        </Link>
      </div>
    </>
  );
}
