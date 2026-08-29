import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "作業時間トラッカー",
  description: "日々の作業時間を記録して、ボトルネックを見つける",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <nav className="flex gap-4 border-b px-6 py-3 text-sm">
          <Link href="/" className="hover:underline">
            今日
          </Link>
          <Link href="/tasks" className="hover:underline">
            タスク
          </Link>
          <Link href="/analytics" className="hover:underline">
            分析
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
