// app/reserve/thanks/page.tsx
import { Suspense } from "react";
import ThanksClient from "./ThanksClient";

// 事前レンダーをやめて動的実行（ビルドエラーを防ぐ）
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function Page() {
  return (
    <main style={{ maxWidth: 720, margin: "32px auto", padding: "0 16px" }}>
      <Suspense fallback={<p>読み込み中…</p>}>
        <ThanksClient />
      </Suspense>
    </main>
  );
}
