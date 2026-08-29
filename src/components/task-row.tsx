import { format } from "date-fns";
import { updateTaskStatus } from "@/server/actions/task";
import { startTimer } from "@/server/actions/timer";
import type { TaskListItem } from "@/server/queries/tasks";

function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}分`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

export function TaskRow({ task }: { task: TaskListItem }) {
  // 表示は丸めた値なので、超過の判定も丸めた値で行う（+0.4 が「+0分」なのに赤い、を防ぐ）
  const roundedDiff = task.diffMin === null ? null : Math.round(task.diffMin);
  const over = roundedDiff !== null && roundedDiff > 0;
  const done = task.status === "done";
  const ratio =
    task.estimateMin !== null && task.estimateMin > 0
      ? Math.min(task.actualMin / task.estimateMin, 1)
      : null;

  return (
    <li
      className={`bg-card rounded-3xl px-5 py-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5 ${
        done ? "opacity-60" : ""
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className="size-3.5 shrink-0 rounded-full"
          style={{ backgroundColor: task.categoryColor }}
          aria-hidden
        />
        <span className="min-w-0 flex-1 truncate text-base font-bold">{task.title}</span>
        {done && (
          <span className="bg-secondary text-muted-foreground shrink-0 rounded-full px-3 py-1 text-xs font-bold">
            完了
          </span>
        )}
        <span className="shrink-0 text-lg font-extrabold tabular-nums">
          {formatDuration(task.actualMin)}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="text-muted-foreground shrink-0 text-sm">{task.categoryName}</span>

        {task.estimateMin === null ? (
          <span className="text-muted-foreground shrink-0 text-sm">見積もりなし</span>
        ) : (
          <span className="flex min-w-40 flex-1 items-center gap-2">
            <span aria-hidden className="bg-gauge-track h-2 flex-1 overflow-hidden rounded-full">
              <span
                className={`block h-full rounded-full ${over ? "bg-live" : "bg-primary"}`}
                style={{ width: `${(ratio ?? 0) * 100}%` }}
              />
            </span>
            <span className={`shrink-0 text-sm tabular-nums ${over ? "text-live font-bold" : ""}`}>
              {over ? `${roundedDiff}分オーバー` : `見積もり ${task.estimateMin}分`}
            </span>
          </span>
        )}

        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {task.lastWorkedAt ? `最終 ${format(task.lastWorkedAt, "M/d")}` : "未着手"}
        </span>

        <span className="ml-auto flex shrink-0 items-center gap-2">
          <form action={startTimer.bind(null, task.id)}>
            <button
              type="submit"
              className="bg-primary focus-visible:ring-primary inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none"
            >
              <span
                aria-hidden
                className="border-y-[5px] border-l-[8px] border-y-transparent border-l-white"
              />
              開始
            </button>
          </form>
          {!done && (
            <form action={updateTaskStatus.bind(null, task.id, "done")}>
              <button
                type="submit"
                className="border-input hover:bg-accent focus-visible:ring-primary rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:ring-4 focus-visible:outline-none"
              >
                完了にする
              </button>
            </form>
          )}
        </span>
      </div>
    </li>
  );
}
