import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryPie } from "@/components/category-pie";
import { DailyStackChart } from "@/components/daily-stack-chart";
import { formatDiff, formatDuration } from "@/lib/format";
import { getAnalytics, type Period } from "@/server/queries/analytics";

export const dynamic = "force-dynamic";

const PERIODS: { label: string; value: Period }[] = [
  { label: "今日", value: "day" },
  { label: "今週", value: "week" },
  { label: "今月", value: "month" },
];

function isPeriod(value: string | undefined): value is Period {
  return value === "day" || value === "week" || value === "month";
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-3xl p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      {children}
    </section>
  );
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  // 不正な値を黙って読み替えると、ブックマークした URL と表示が食い違ったままになる。
  // 正しい URL に直してから描画する。
  if (period !== undefined && !isPeriod(period)) redirect("/analytics?period=week");
  const selected: Period = isPeriod(period) ? period : "week";
  const view = await getAnalytics(selected);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-4 pb-16">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-2">
        <h1 className="text-xl font-bold">分析</h1>
        <p className="text-muted-foreground text-sm tabular-nums">
          {view.range.from} 〜 {view.range.to}
        </p>
      </div>

      <nav aria-label="期間">
        <ul className="flex flex-wrap gap-2">
          {PERIODS.map((item) => {
            const active = selected === item.value;
            return (
              <li key={item.value}>
                <Link
                  href={`/analytics?period=${item.value}`}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-card font-bold shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                      : "text-muted-foreground hover:bg-card/60 font-medium"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <p className="text-muted-foreground text-sm">合計時間</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {formatDuration(view.totalMinutes)}
          </p>
        </Card>
        <Card>
          <p className="text-muted-foreground text-sm">平均継続時間</p>
          <p className="mt-1 text-3xl font-extrabold tabular-nums">
            {formatDuration(view.averageFocusMinutes)}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-bold">カテゴリ別の時間</h2>
        {view.categoryTotals.length === 0 ? (
          <p className="text-muted-foreground mt-3 text-base">この期間の記録はまだありません。</p>
        ) : (
          <>
            <CategoryPie totals={view.categoryTotals} />
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {view.categoryTotals.map((total) => (
                <li
                  key={total.categoryId}
                  className="bg-background flex items-center gap-3 rounded-2xl px-4 py-3"
                >
                  <span
                    aria-hidden
                    className="size-3.5 shrink-0 rounded-full"
                    style={{ backgroundColor: total.color }}
                  />
                  <span className="flex-1 text-base font-medium">{total.name}</span>
                  <span className="text-base font-bold tabular-nums">
                    {formatDuration(total.minutes)}
                  </span>
                  <span className="text-muted-foreground w-11 text-right text-sm tabular-nums">
                    {view.totalMinutes > 0
                      ? ((total.minutes / view.totalMinutes) * 100).toFixed(0)
                      : "0"}
                    %
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      {/* 「今日」は1本の棒にしかならず、上の円グラフと同じことしか言わないので出さない */}
      {selected !== "day" && (
        <Card>
          <h2 className="text-lg font-bold">日ごとの推移</h2>
          {view.categories.length === 0 ? (
            <p className="text-muted-foreground mt-3 text-base">この期間の記録はまだありません。</p>
          ) : (
            <div className="mt-3">
              <DailyStackChart daily={view.daily} categories={view.categories} />
            </div>
          )}
        </Card>
      )}

      <Card>
        <h2 className="text-lg font-bold">見積もりと実績</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          この期間に作業したタスクが対象です。実績はそのタスクの全期間の合計なので、上の「合計時間」（この期間のみ）とは意味が異なります。
        </p>

        {view.estimateSummary && (
          <div className="bg-background mt-4 rounded-2xl px-4 py-4">
            <p className="text-base">
              見積もりのある{view.estimateSummary.taskCount}件の合計は{" "}
              <span className="font-bold tabular-nums">
                見積もり {formatDuration(view.estimateSummary.totalEstimateMin)}
              </span>{" "}
              に対して{" "}
              <span className="font-bold tabular-nums">
                実績 {formatDuration(view.estimateSummary.totalActualMin)}
              </span>
              。
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span
                className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                  view.estimateSummary.diffMin > 0
                    ? "bg-live-soft text-live"
                    : "bg-secondary text-muted-foreground"
                }`}
              >
                {formatDiff(view.estimateSummary.diffMin)}（見積もりの
                {view.estimateSummary.ratio.toFixed(1)}倍）
              </span>
              <span className="text-muted-foreground text-sm">
                {view.estimateSummary.taskCount}件中 {view.estimateSummary.overCount}件が超過
              </span>
            </p>
          </div>
        )}

        {view.estimates.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-base">
            見積もりを設定して作業したタスクがまだありません。
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {view.estimates.map((estimate) => {
              const over = estimate.diffMin > 0;
              return (
                <li
                  key={estimate.taskId}
                  className="bg-background flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-base font-medium">
                    {estimate.title}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
                    見積もり {formatDuration(estimate.estimateMin)} → 実績{" "}
                    {formatDuration(estimate.actualMin)}
                  </span>
                  {/* 超過だけでなく、どれだけ余ったかも出す。外し方の向きが分からないと振り返れない */}
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
                      over ? "bg-live-soft text-live" : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {formatDiff(estimate.diffMin)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/*
          見積もりを付け忘れた作業こそ振り返りから漏れやすい。
          上の表に出てこない時間が何分あるのかを、同じカードの中で示す。
        */}
        {view.unestimated.length > 0 && (
          <div className="border-border mt-5 border-t pt-4">
            <h3 className="text-base font-bold">見積もりなしで作業した分</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              合計 {formatDuration(view.unestimated.reduce((sum, work) => sum + work.actualMin, 0))}
              は上の比較に入っていません。見積もりを入れると次から振り返りの対象になります。
            </p>
            <ul className="mt-3 space-y-2">
              {view.unestimated.map((work) => (
                <li
                  key={work.taskId}
                  className="bg-background flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl px-4 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-base font-medium">
                    {work.title}
                  </span>
                  <span className="shrink-0 text-base font-bold tabular-nums">
                    {formatDuration(work.actualMin)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </main>
  );
}
