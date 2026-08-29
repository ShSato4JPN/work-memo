import Link from "next/link";
import { CategoryPie } from "@/components/category-pie";
import { DailyStackChart } from "@/components/daily-stack-chart";
import { getAnalytics, type Period } from "@/server/queries/analytics";

export const dynamic = "force-dynamic";

const PERIODS: { label: string; value: Period }[] = [
  { label: "日", value: "day" },
  { label: "週", value: "week" },
  { label: "月", value: "month" },
];

function isPeriod(value: string | undefined): value is Period {
  return value === "day" || value === "week" || value === "month";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const selected: Period = isPeriod(period) ? period : "week";
  const view = await getAnalytics(selected);

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">分析</h1>
        <p className="text-muted-foreground text-sm">
          {view.range.from} 〜 {view.range.to}
        </p>
      </div>

      <nav className="flex gap-2 text-sm">
        {PERIODS.map((item) => (
          <Link
            key={item.value}
            href={`/analytics?period=${item.value}`}
            className={`rounded-md border px-3 py-1 ${selected === item.value ? "bg-accent" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <section className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">合計時間</p>
          <p className="text-2xl font-bold tabular-nums">{(view.totalMinutes / 60).toFixed(1)}h</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">割り込み回数</p>
          <p className="text-2xl font-bold tabular-nums">{view.interruptionCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">平均継続時間</p>
          <p className="text-2xl font-bold tabular-nums">
            {Math.round(view.averageFocusMinutes)}分
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">カテゴリ別の時間配分</h2>
        <CategoryPie totals={view.categoryTotals} />
        <ul className="text-sm">
          {view.categoryTotals.map((total) => (
            <li key={total.categoryId} className="flex justify-between border-b py-1">
              <span>{total.name}</span>
              <span className="tabular-nums">
                {Math.round(total.minutes)}分（
                {view.totalMinutes > 0
                  ? ((total.minutes / view.totalMinutes) * 100).toFixed(0)
                  : "0"}
                %）
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">日ごとの推移</h2>
        <DailyStackChart daily={view.daily} categories={view.categories} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">見積もりと実績（この期間に作業したタスクの全期間合計）</h2>
        <p className="text-muted-foreground text-xs">
          実績はタスクの全期間の合計です。上の「合計時間」（この期間だけの合計）とは意味が異なります。
        </p>
        {view.estimates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            見積もりを設定して作業したタスクがまだありません。
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2">タスク</th>
                <th className="py-2 text-right">見積もり</th>
                <th className="py-2 text-right">実績</th>
                <th className="py-2 text-right">比率</th>
              </tr>
            </thead>
            <tbody>
              {view.estimates.map((estimate) => (
                <tr key={estimate.taskId} className="border-b">
                  <td className="py-2">{estimate.title}</td>
                  <td className="py-2 text-right tabular-nums">{estimate.estimateMin}分</td>
                  <td className="py-2 text-right tabular-nums">
                    {Math.round(estimate.actualMin)}分
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${
                      estimate.ratio > 1 ? "text-destructive" : ""
                    }`}
                  >
                    {estimate.ratio.toFixed(1)}倍
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
