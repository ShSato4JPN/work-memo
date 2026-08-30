"use client";

import { format } from "date-fns";

import { useTaskRow } from "@/hooks/use-task-row";
import { formatClock, formatDuration } from "@/lib/format";
import { updateTaskStatus } from "@/server/actions/task";
import { startTimer, stopTimer } from "@/server/actions/timer";
import type { TaskListItem } from "@/server/queries/tasks";

type Category = { id: number; name: string; color: string };

const STATUS_LABEL: Record<string, string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
};

/** タスク1件の行。開始・停止・完了・編集・削除と経過時間の表示がこの行で完結する */
export function TaskRow({ task, categories }: { task: TaskListItem; categories: Category[] }) {
  const row = useTaskRow(task);
  const { progress, isRunning, isDone, editor } = row;

  if (row.editing) {
    return (
      <li className="bg-card ring-primary/40 rounded-3xl p-5 shadow-sm ring-2">
        <form
          action={editor.save}
          className="space-y-3"
          onKeyDown={(event) => {
            if (event.key === "Escape") row.cancelEdit();
          }}
        >
          <input
            autoFocus
            value={editor.title}
            onChange={(event) => editor.setTitle(event.target.value)}
            aria-label="タスク名"
            className="border-input bg-background h-12 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-current/20"
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-muted-foreground text-sm" htmlFor={`task-category-${task.id}`}>
              カテゴリ
            </label>
            <select
              id={`task-category-${task.id}`}
              value={editor.categoryId}
              onChange={(event) => editor.setCategoryId(event.target.value)}
              className="border-input bg-background h-11 rounded-xl border px-3 text-sm"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <label
              className="text-muted-foreground ml-2 text-sm"
              htmlFor={`task-estimate-${task.id}`}
            >
              見積もり
            </label>
            <input
              id={`task-estimate-${task.id}`}
              type="number"
              min={1}
              value={editor.estimate}
              onChange={(event) => editor.setEstimate(event.target.value)}
              placeholder="任意"
              className="border-input bg-background h-11 w-24 rounded-xl border px-3 text-sm tabular-nums"
            />
            <span className="text-muted-foreground text-sm">分</span>

            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={row.cancelEdit}
                className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={row.pending}
                className="bg-primary focus-visible:ring-primary rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
              >
                {row.pending ? "保存中…" : "保存"}
              </button>
            </span>
          </div>

          {row.error && <p className="text-live text-sm font-bold">{row.error}</p>}
        </form>

        <div className="border-border mt-4 border-t pt-4">
          {row.confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted-foreground flex-1 text-sm">
                {row.hasRecords
                  ? "このタスクを一覧から隠します。記録した時間は分析に残ります。"
                  : "記録が1件もないので、このタスクを完全に削除します。"}
              </p>
              <button
                type="button"
                onClick={() => row.setConfirmingDelete(false)}
                className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2 text-sm font-bold"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={row.remove}
                disabled={row.pending}
                className="bg-live focus-visible:ring-live rounded-full px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
              >
                {row.hasRecords ? "隠す" : "削除する"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => row.setConfirmingDelete(true)}
              className="text-live hover:bg-live-soft rounded-full px-4 py-2 text-sm font-bold transition"
            >
              このタスクを削除
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <li
      className={`rounded-3xl px-5 py-4 shadow-sm ring-1 transition ${
        isDone
          ? "bg-secondary ring-border"
          : isRunning
            ? "bg-card ring-live/40"
            : "bg-card ring-black/5 dark:ring-white/5"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={`size-3.5 shrink-0 rounded-full ${
            isRunning ? "motion-safe:animate-pulse" : ""
          }`}
          style={{ backgroundColor: task.categoryColor }}
          aria-hidden
        />
        <span
          className={`min-w-0 flex-1 truncate text-base font-bold ${
            isDone ? "text-muted-foreground line-through" : ""
          }`}
        >
          {task.title}
        </span>
        {isDone && (
          <span className="bg-done inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold text-white">
            <span aria-hidden>✓</span>
            完了
          </span>
        )}
        {isRunning ? (
          <span
            className={`shrink-0 text-2xl font-extrabold tabular-nums ${
              progress.isOverEstimate ? "text-live" : ""
            }`}
            suppressHydrationWarning
            aria-label={`計測中 通算 ${formatClock(progress.totalSeconds)}`}
          >
            {formatClock(progress.totalSeconds)}
          </span>
        ) : (
          <span
            className={`shrink-0 text-lg font-extrabold tabular-nums ${
              isDone ? "text-muted-foreground" : ""
            }`}
          >
            {formatDuration(progress.totalMinutes)}
          </span>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-3">
        <span className="text-muted-foreground shrink-0 text-sm">{task.categoryName}</span>

        {progress.gaugeRatio === null ? (
          <span className="text-muted-foreground shrink-0 text-sm">見積もりなし</span>
        ) : (
          <span className="flex min-w-40 flex-1 items-center gap-2">
            <span aria-hidden className="bg-gauge-track h-2 flex-1 overflow-hidden rounded-full">
              <span
                className={`block h-full rounded-full ${
                  progress.isOverEstimate ? "bg-live" : "bg-primary"
                }`}
                style={{ width: `${progress.gaugeRatio * 100}%` }}
              />
            </span>
            <span
              className={`shrink-0 text-sm tabular-nums ${
                progress.isOverEstimate ? "text-live font-bold" : ""
              }`}
            >
              {progress.isOverEstimate
                ? `${progress.diffMinutes}分オーバー`
                : `見積もり ${task.estimateMin}分`}
            </span>
          </span>
        )}

        {/* 状態と最終作業日は別々に出す。計測中だけ状態が読めなくなるのを避けるため */}
        {!isDone && (
          <span className="bg-secondary text-muted-foreground shrink-0 rounded-full px-3 py-1 text-xs font-bold">
            {STATUS_LABEL[task.status] ?? task.status}
          </span>
        )}
        {task.lastWorkedAt && (
          <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
            最終 {format(task.lastWorkedAt, "M/d")}
          </span>
        )}

        <span className="ml-auto flex shrink-0 items-center gap-2">
          {isDone ? (
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
              {isRunning ? (
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
          <button
            type="button"
            onClick={row.openEditor}
            aria-label={`「${task.title}」を編集`}
            className="border-input hover:bg-accent focus-visible:ring-ring rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:ring-4 focus-visible:outline-none"
          >
            編集
          </button>
        </span>
      </div>
    </li>
  );
}
