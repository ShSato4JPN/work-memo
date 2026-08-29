import { StaleEntryDialog } from "@/components/stale-entry-dialog";
import { TodayLog } from "@/components/today-log";
import { getTodayView } from "@/server/queries/today";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const now = new Date();
  const view = await getTodayView(now);
  const totalHours = view.totalMinutes / 60;

  return (
    <main className="mx-auto max-w-5xl space-y-10 px-5 py-8">
      {view.staleRunning && (
        <StaleEntryDialog
          entryId={view.staleRunning.entryId}
          title={view.staleRunning.title}
          startedAt={view.staleRunning.startedAt}
          now={now}
        />
      )}

      <header className="flex items-baseline justify-between gap-4">
        <h1 className="text-[22px] font-semibold tracking-tight">今日</h1>
        <p className="text-muted-foreground font-mono text-[12px]">
          合計{" "}
          <span className="text-foreground text-[18px] tabular-nums">{totalHours.toFixed(1)}</span>{" "}
          h<span className="text-muted-foreground"> / {Math.round(view.totalMinutes)}分</span>
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
          内訳
        </h2>
        {view.categoryTotals.length === 0 ? (
          <p className="text-muted-foreground text-[13px]">
            まだ今日の記録はありません。上の「作業を開始」から始められます。
          </p>
        ) : (
          <>
            <div className="border-border flex h-2 overflow-hidden rounded-full border">
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
            <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2">
              {view.categoryTotals.map((total) => (
                <li
                  key={total.categoryId}
                  className="border-border/70 flex items-center gap-2 border-b py-1.5 text-[13px]"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: total.color }}
                  />
                  <span className="flex-1">{total.name}</span>
                  <span className="font-mono tabular-nums">{Math.round(total.minutes)}分</span>
                  <span className="text-muted-foreground w-10 text-right font-mono text-[11px]">
                    {((total.minutes / view.totalMinutes) * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-muted-foreground font-mono text-[11px] tracking-[0.18em] uppercase">
          ログ
        </h2>
        <TodayLog entries={view.entries} />
      </section>
    </main>
  );
}
