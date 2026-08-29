"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { updateTaskStatus } from "@/server/actions/task";
import { startTimer, stopTimer } from "@/server/actions/timer";
import type { TaskListItem } from "@/server/queries/tasks";

function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}分`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mmss = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return `${hours}:${mmss}`;
}

/**
 * タスク1件の行。開始・停止・完了と経過時間の表示がこの行で完結する。
 *
 * 表示する時間は「完了した分（finishedMin）＋ いま計測中の経過」。
 * 経過は 1 秒ごとに startedAt からの差分を計算し直すので、クライアントに溜め込まない。
 */
export function TaskRow({ task }: { task: TaskListItem }) {
  const running = task.runningSince !== null;
  const startedAtMs = task.runningSince?.getTime() ?? null;

  const [sessionSeconds, setSessionSeconds] = useState(() =>
    startedAtMs === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  );

  useEffect(() => {
    if (startedAtMs === null) return;
    const tick = () =>
      setSessionSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    // 壁時計という外部システムとの同期。SSR 時の値をクライアントの現在時刻へ引き直す
    // oxlint-disable-next-line react/set-state-in-effect
    tick();
    const timerId = setInterval(tick, 1000);
    return () => clearInterval(timerId);
  }, [startedAtMs]);

  const totalSeconds = Math.round(task.finishedMin * 60) + (running ? sessionSeconds : 0);
  const totalMin = totalSeconds / 60;

  const roundedDiff = task.estimateMin === null ? null : Math.round(totalMin - task.estimateMin);
  const over = roundedDiff !== null && roundedDiff > 0;
  const done = task.status === "done";
  const ratio =
    task.estimateMin !== null && task.estimateMin > 0
      ? Math.min(totalMin / task.estimateMin, 1)
      : null;

  return (
    <li
      className={`rounded-3xl px-5 py-4 shadow-sm ring-1 transition ${
        done
          ? "bg-secondary ring-border"
          : running
            ? "bg-card ring-live/40"
            : "bg-card ring-black/5 dark:ring-white/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={`size-3.5 shrink-0 rounded-full ${running ? "motion-safe:animate-pulse" : ""}`}
          style={{ backgroundColor: task.categoryColor }}
          aria-hidden
        />
        <span
          className={`min-w-0 flex-1 truncate text-base font-bold ${
            done ? "text-muted-foreground line-through" : ""
          }`}
        >
          {task.title}
        </span>
        {done && (
          <span className="bg-done inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white">
            <span aria-hidden>✓</span>
            完了
          </span>
        )}
        {running ? (
          <span
            className={`shrink-0 text-2xl font-extrabold tabular-nums ${over ? "text-live" : ""}`}
            suppressHydrationWarning
            aria-label={`計測中 通算 ${formatClock(totalSeconds)}`}
          >
            {formatClock(totalSeconds)}
          </span>
        ) : (
          <span
            className={`shrink-0 text-lg font-extrabold tabular-nums ${
              done ? "text-muted-foreground" : ""
            }`}
          >
            {formatDuration(totalMin)}
          </span>
        )}
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
          {done ? (
            // 完了したタスクは開始できない。やり直したいときは取り消して進行中に戻す
            <form action={updateTaskStatus.bind(null, task.id, "doing")}>
              <button
                type="submit"
                className="border-input hover:bg-accent focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full border-2 px-5 py-2 text-sm font-bold transition focus-visible:ring-4 focus-visible:outline-none"
              >
                <span aria-hidden>↩</span>
                取り消し
              </button>
            </form>
          ) : (
            <>
              {running ? (
                <form action={stopTimer.bind(null, task.id)}>
                  <button
                    type="submit"
                    className="bg-live focus-visible:ring-live inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none"
                  >
                    <span aria-hidden className="size-2.5 rounded-[2px] bg-white" />
                    停止
                  </button>
                </form>
              ) : (
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
              )}
              <form action={updateTaskStatus.bind(null, task.id, "done")}>
                <button
                  type="submit"
                  className="bg-done focus-visible:ring-done inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none"
                >
                  <span aria-hidden>✓</span>
                  完了
                </button>
              </form>
            </>
          )}
        </span>
      </div>
    </li>
  );
}
