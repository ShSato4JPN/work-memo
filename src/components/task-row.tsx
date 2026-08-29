import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { updateTaskStatus } from "@/server/actions/task";
import { startTimer } from "@/server/actions/timer";
import type { TaskListItem } from "@/server/queries/tasks";

function diffLabel(rounded: number | null): string {
  if (rounded === null) return "—";
  return rounded >= 0 ? `+${rounded}分` : `${rounded}分`;
}

export function TaskRow({ task }: { task: TaskListItem }) {
  // 表示は丸めた値なので、超過（赤字）の判定も丸めた値で行う（+0.4 が「+0分」なのに赤い、を防ぐ）
  const roundedDiff = task.diffMin === null ? null : Math.round(task.diffMin);

  return (
    <tr className="border-b">
      <td className="py-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: task.categoryColor }}
            aria-hidden
          />
          <span className="min-w-0 flex-1 truncate">{task.title}</span>
        </div>
      </td>
      <td className="text-muted-foreground py-2 text-sm">{task.categoryName}</td>
      <td className="py-2 text-right tabular-nums">
        {task.estimateMin === null ? "—" : `${task.estimateMin}分`}
      </td>
      <td className="py-2 text-right tabular-nums">{Math.round(task.actualMin)}分</td>
      <td
        className={`py-2 text-right tabular-nums ${
          roundedDiff !== null && roundedDiff > 0 ? "text-destructive" : ""
        }`}
      >
        {diffLabel(roundedDiff)}
      </td>
      <td className="text-muted-foreground py-2 text-right text-sm">
        {task.lastWorkedAt ? format(task.lastWorkedAt, "MM/dd") : "—"}
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-1">
          <form action={startTimer.bind(null, task.id)}>
            <Button type="submit" size="sm" variant="ghost">
              Start
            </Button>
          </form>
          {task.status !== "done" && (
            <form action={updateTaskStatus.bind(null, task.id, "done")}>
              <Button type="submit" size="sm" variant="ghost">
                完了
              </Button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}
