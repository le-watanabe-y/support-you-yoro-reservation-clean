import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "サポート予約フォーム",
  description: "最小構成のサンプル"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
