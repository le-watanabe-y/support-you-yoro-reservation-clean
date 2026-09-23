import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./product.css";
import { ORGANIZATION } from "@/lib/facility-info.mjs";

export const metadata: Metadata = {
  title: ORGANIZATION.serviceName,
  description: "病児保育の予約。利用登録・申込み・書類提出・予約状況の確認ができます。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#163955" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="antialiased">{children}</body>
    </html>
  );
}
