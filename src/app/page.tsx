import Link from "next/link";
import { formatDuration } from "@/lib/format";
import { DayTimeline } from "@/components/day-timeline";
import { StaleEntryDialog } from "@/components/stale-entry-dialog";
import { TodayLog } from "@/components/today-log";
import { getTodayView } from "@/server/queries/today";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = new Date();
  const view = await getTodayView(now);

  // 合計0分のときに 0/0 で NaN や「100%」を出さないための割合計算
  const share = (minutes: number) =>
    view.totalMinutes > 0 ? (minutes / view.totalMinutes) * 100 : 0;
  const overlapMinutes = view.totalMinutes - view.elapsedMinutes;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-4 pb-16">
      {view.staleRunning && (
        <StaleEntryDialog
          entryId={view.staleRunning.entryId}
          title={view.staleRunning.title}
          startedAt={view.staleRunning.startedAt}
          now={now}
        />
      )}

      <section className="bg-card rounded-3xl p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="text-xl font-bold">今日の計測時間</h1>
          <p className="text-3xl font-extrabold tabular-nums">
            {formatDuration(view.totalMinutes)}
          </p>
        </div>

        {/*
          並行計測を許しているので、カテゴリ別を足した値は実際に過ぎた時間を超えうる。
          「合計」だけを出すと数字が盛られて見えるため、重なっている分を明示する。
        */}
        {overlapMinutes >= 1 && (
          <p className="text-muted-foreground mt-2 text-sm">
            うち {formatDuration(overlapMinutes)} は並行して計測した重複分です（実際の経過は
            {formatDuration(view.elapsedMinutes)}）。
          </p>
        )}

        {view.categoryTotals.length === 0 ? (
          <div className="mt-4 space-y-3">
            <p className="text-muted-foreground text-base">
              まだ今日の記録がありません。「タスク」でタスクを追加し、その行の「開始」を押すと計測が始まります。
            </p>
            <Link
              href="/tasks"
              className="bg-primary focus-visible:ring-primary inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none"
            >
              タスクへ移動
            </Link>
          </div>
        ) : (
          <>
            <div className="mt-5 flex h-4 gap-1 overflow-hidden rounded-full">
              {view.categoryTotals.map((total) => (
                <div
                  key={total.categoryId}
                  className="first:rounded-l-full last:rounded-r-full"
                  style={{
                    backgroundColor: total.color,
                    width: `${share(total.minutes)}%`,
                  }}
                  title={`${total.name} ${formatDuration(total.minutes)}`}
                />
              ))}
            </div>

            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
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
                    {share(total.minutes).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="bg-card rounded-3xl p-6 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <h2 className="mb-4 text-lg font-bold">時間の使い方</h2>
        <DayTimeline
          entries={view.entries.map((entry) => ({
            id: entry.id,
            taskId: entry.taskId,
            title: entry.title,
            categoryColor: entry.categoryColor,
            startedAt: entry.startedAt,
            endedAt: entry.endedAt,
          }))}
          day={now}
          now={now}
        />
      </section>

      <section className="space-y-3">
        <h2 className="px-2 text-lg font-bold">今日の記録</h2>
        <TodayLog entries={view.entries} />
      </section>
    </main>
  );
}
