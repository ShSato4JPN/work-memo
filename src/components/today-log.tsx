import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startTimer } from "@/server/actions/timer";
import type { TodayViewEntry } from "@/server/queries/today";

function durationLabel(startedAt: Date, endedAt: Date | null): string {
  if (endedAt === null) return "計測中";
  const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);
  return `${minutes}分`;
}

export function TodayLog({ entries }: { entries: TodayViewEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">まだ今日の記録はありません。</p>;
  }

  return (
    <ul className="divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 py-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.categoryColor }}
            aria-hidden
          />
          <span className="text-muted-foreground w-28 shrink-0 font-mono text-xs">
            {format(entry.startedAt, "HH:mm")}–{entry.endedAt ? format(entry.endedAt, "HH:mm") : ""}
          </span>
          <span className="min-w-0 flex-1 truncate">{entry.title}</span>
          {entry.isInterruption && <Badge variant="outline">割り込み</Badge>}
          <span className="w-16 shrink-0 text-right text-sm">
            {durationLabel(entry.startedAt, entry.endedAt)}
          </span>
          <form action={startTimer.bind(null, entry.taskId)}>
            <Button type="submit" variant="ghost" size="sm">
              再開
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
