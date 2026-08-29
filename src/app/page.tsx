import { DayTimeline } from "@/components/day-timeline";
import { StaleEntryDialog } from "@/components/stale-entry-dialog";
import { TodayLog } from "@/components/today-log";
import { getTodayView } from "@/server/queries/today";

export const dynamic = "force-dynamic";

function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}分`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

export default async function TodayPage() {
  const now = new Date();
  const view = await getTodayView(now);

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
          <h1 className="text-xl font-bold">今日の合計</h1>
          <p className="text-3xl font-extrabold tabular-nums">
            {formatDuration(view.totalMinutes)}
          </p>
        </div>

        {view.categoryTotals.length === 0 ? (
          <p className="text-muted-foreground mt-4 text-base">
            まだ記録がありません。上の「開始」から始められます。
          </p>
        ) : (
          <>
            <div className="mt-5 flex h-4 gap-1 overflow-hidden rounded-full">
              {view.categoryTotals.map((total) => (
                <div
                  key={total.categoryId}
                  className="first:rounded-l-full last:rounded-r-full"
                  style={{
                    backgroundColor: total.color,
                    width: `${(total.minutes / view.totalMinutes) * 100}%`,
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
                    {((total.minutes / view.totalMinutes) * 100).toFixed(0)}%
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
