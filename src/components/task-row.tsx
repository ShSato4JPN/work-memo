import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { updateTaskStatus } from "@/server/actions/task";
import { startTimer } from "@/server/actions/timer";
import type { TaskListItem } from "@/server/queries/tasks";

function diffLabel(diffMin: number | null): string {
  if (diffMin === null) return "—";
  const rounded = Math.round(diffMin);
  return rounded >= 0 ? `+${rounded}分` : `${rounded}分`;
}

export function TaskRow({ task }: { task: TaskListItem }) {
  return (
    <tr className="border-b">
      <td className="py-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: task.categoryColor }}
            aria-hidden
          />
          <span className="truncate">{task.title}</span>
        </div>
      </td>
      <td className="text-muted-foreground py-2 text-sm">{task.categoryName}</td>
      <td className="py-2 text-right tabular-nums">
        {task.estimateMin === null ? "—" : `${task.estimateMin}分`}
      </td>
      <td className="py-2 text-right tabular-nums">{Math.round(task.actualMin)}分</td>
      <td
        className={`py-2 text-right tabular-nums ${
          task.diffMin !== null && task.diffMin > 0 ? "text-destructive" : ""
        }`}
      >
        {diffLabel(task.diffMin)}
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
