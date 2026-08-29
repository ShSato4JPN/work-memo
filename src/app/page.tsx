import { RunningTimer } from "@/components/running-timer";
import { StaleEntryDialog } from "@/components/stale-entry-dialog";
import { StartPanel } from "@/components/start-panel";
import { TodayLog } from "@/components/today-log";
import { getTodayView } from "@/server/queries/today";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const view = await getTodayView();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">今日</h1>

      {view.staleRunning && (
        <StaleEntryDialog
          entryId={view.staleRunning.entryId}
          title={view.staleRunning.title}
          startedAt={view.staleRunning.startedAt}
        />
      )}

      {view.running ? (
        <RunningTimer
          title={view.running.title}
          categoryName={view.running.categoryName}
          categoryColor={view.running.categoryColor}
          startedAt={view.running.startedAt}
        />
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          計測していません。下から作業を開始してください。
        </p>
      )}

      <StartPanel activeTasks={view.activeTasks} categories={view.categories} />

      <section className="space-y-2">
        <h2 className="font-semibold">今日のログ</h2>
        <TodayLog entries={view.entries} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">今日の合計 {Math.round(view.totalMinutes)}分</h2>
        <div className="flex h-4 overflow-hidden rounded-full">
          {view.categoryTotals.map((total) => (
            <div
              key={total.categoryId}
              style={{
                backgroundColor: total.color,
                width: `${(total.minutes / view.totalMinutes) * 100}%`,
              }}
              title={`${total.name} ${Math.round(total.minutes)}分`}
            />
          ))}
        </div>
        <ul className="text-sm">
          {view.categoryTotals.map((total) => (
            <li key={total.categoryId} className="flex justify-between">
              <span>{total.name}</span>
              <span className="tabular-nums">{Math.round(total.minutes)}分</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
