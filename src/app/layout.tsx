import type { Metadata } from "next";
import { M_PLUS_Rounded_1c } from "next/font/google";
import { TimerBar } from "@/components/timer-bar";
import { SiteNav } from "@/components/site-nav";
import { getTimerBarView } from "@/server/queries/timer-bar";
import "./globals.css";

// 丸ゴシック1書体で通す。日本語・英数字・時計まで同じ表情で、読みやすさを最優先にする。
const rounded = M_PLUS_Rounded_1c({
  variable: "--font-rounded",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: "作業時間トラッカー",
  description: "日々の作業時間を記録して、ボトルネックを見つける",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const timerBar = await getTimerBarView();

  return (
    <html lang="ja" className={`${rounded.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <TimerBar view={timerBar} />
        <SiteNav />
        <div className="flex-1">{children}</div>
      </body>
    </html>
  );
}
