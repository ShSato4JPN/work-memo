import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_JP } from "next/font/google";
import { TimerBar } from "@/components/timer-bar";
import { SiteNav } from "@/components/site-nav";
import { getTimerBarView } from "@/server/queries/timer-bar";
import "./globals.css";

// 計測器のための書体系。日本語も数字も同じ設計思想で揃える。
const plexSans = IBM_Plex_Sans_JP({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "作業時間トラッカー",
  description: "日々の作業時間を記録して、ボトルネックを見つける",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const timerBar = await getTimerBarView();

  return (
    <html lang="ja" className={`${plexSans.variable} ${plexMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <TimerBar view={timerBar} />
        <SiteNav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
