import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ドット絵メーカー",
  description: "画像を2〜4色のドット絵に変換します",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className="bg-gray-100 min-h-screen">{children}</body>
    </html>
  );
}
