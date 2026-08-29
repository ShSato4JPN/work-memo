import { format } from "date-fns";
import { EntryTimeEditor } from "@/components/entry-time-editor";
import type { TodayViewEntry } from "@/server/queries/today";

/**
 * 表示する分数は「今日に計上された分」（TodayViewEntry.todayMinutes）。
 * 日を跨いだエントリで、行の分数と今日の合計が食い違わないようにするため、
 * ここで endedAt - startedAt を計算し直してはいけない。
 */
function durationLabel(entry: TodayViewEntry): string {
  if (entry.endedAt === null) return "計測中";
  return `${Math.round(entry.todayMinutes)}分`;
}

/** 開始が今日でない行は日付まで表示して、今日の作業と読み違えられないようにする */
function timeRangeLabel(entry: TodayViewEntry): string {
  const start = entry.startedOnEarlierDay
    ? format(entry.startedAt, "MM/dd HH:mm")
    : format(entry.startedAt, "HH:mm");
  const end = entry.endedAt ? format(entry.endedAt, "HH:mm") : "現在";
  return `${start} → ${end}`;
}

export function TodayLog({ entries }: { entries: TodayViewEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="bg-card text-muted-foreground rounded-3xl px-6 py-8 text-center text-base shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        まだ記録がありません。
      </p>
    );
  }

  // 一番長い記録を基準に、行ごとの長さを目で比べられるようにする
  const longest = Math.max(...entries.map((entry) => entry.todayMinutes), 1);

  return (
    <ul className="space-y-2">
      {entries.map((entry) => (
        <li
          key={entry.id}
          className="bg-card rounded-3xl px-5 py-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span
              className="size-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: entry.categoryColor }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-base font-bold">{entry.title}</span>

            {entry.startedOnEarlierDay && (
              <span className="bg-secondary text-muted-foreground shrink-0 rounded-full px-3 py-1 text-xs font-medium">
                日跨ぎ
              </span>
            )}

            <span
              className={`shrink-0 text-lg font-extrabold tabular-nums ${
                entry.endedAt === null ? "text-live" : ""
              }`}
            >
              {durationLabel(entry)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
              {timeRangeLabel(entry)}
            </span>

            <span
              aria-hidden
              className="bg-gauge-track hidden h-2 min-w-16 flex-1 overflow-hidden rounded-full sm:block"
            >
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${Math.max((entry.todayMinutes / longest) * 100, 3)}%`,
                  backgroundColor: entry.categoryColor,
                }}
              />
            </span>

            <span className="ml-auto shrink-0">
              <EntryTimeEditor
                entryId={entry.id}
                title={entry.title}
                startedAt={entry.startedAt}
                endedAt={entry.endedAt}
              />
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}
