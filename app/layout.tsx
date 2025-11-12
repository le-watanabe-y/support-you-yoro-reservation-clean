import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ご予約フォーム",
  description: "サポート予約フォーム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
