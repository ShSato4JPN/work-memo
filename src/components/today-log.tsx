import { format } from "date-fns";
import { EntryTimeEditor } from "@/components/entry-time-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startTimer } from "@/server/actions/timer";
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
  const end = entry.endedAt ? format(entry.endedAt, "HH:mm") : "";
  return `${start}–${end}`;
}

export function TodayLog({ entries }: { entries: TodayViewEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">まだ今日の記録はありません。</p>;
  }

  return (
    <ul className="divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-wrap items-center gap-3 py-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.categoryColor }}
            aria-hidden
          />
          <span className="text-muted-foreground w-32 shrink-0 font-mono text-xs">
            {timeRangeLabel(entry)}
          </span>
          <span className="min-w-0 flex-1 truncate">{entry.title}</span>
          {entry.startedOnEarlierDay && <Badge variant="outline">日跨ぎ</Badge>}
          {entry.isInterruption && <Badge variant="outline">割り込み</Badge>}
          <span className="w-16 shrink-0 text-right text-sm">{durationLabel(entry)}</span>
          <form action={startTimer.bind(null, entry.taskId)}>
            <Button type="submit" variant="ghost" size="sm">
              再開
            </Button>
          </form>
          <EntryTimeEditor
            entryId={entry.id}
            title={entry.title}
            startedAt={entry.startedAt}
            endedAt={entry.endedAt}
          />
        </li>
      ))}
    </ul>
  );
}
