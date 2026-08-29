"use client";

import { format } from "date-fns";
import { useEffect, useState } from "react";
import { deleteTask, updateTask, updateTaskStatus } from "@/server/actions/task";
import { startTimer, stopTimer } from "@/server/actions/timer";
import type { TaskListItem } from "@/server/queries/tasks";

type Category = { id: number; name: string; color: string };

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

const STATUS_LABEL: Record<string, string> = {
  todo: "未着手",
  doing: "進行中",
  done: "完了",
};

/**
 * タスク1件の行。開始・停止・完了・編集・削除と経過時間の表示がこの行で完結する。
 *
 * 表示する時間は「完了した分（finishedMin）＋ いま計測中の経過」。
 * 経過は 1 秒ごとに startedAt からの差分を計算し直すので、クライアントに溜め込まない。
 */
export function TaskRow({ task, categories }: { task: TaskListItem; categories: Category[] }) {
  const running = task.runningSince !== null;
  const startedAtMs = task.runningSince?.getTime() ?? null;

  const [sessionSeconds, setSessionSeconds] = useState(() =>
    startedAtMs === null ? 0 : Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  );

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(String(task.categoryId));
  const [estimate, setEstimate] = useState(
    task.estimateMin === null ? "" : String(task.estimateMin),
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  // 記録が1件でもあるタスクは、削除しても集計を保つため一覧から隠すだけになる
  const hasRecords = task.lastWorkedAt !== null;

  function cancelEdit() {
    // 編集前の値に戻してから閉じる
    setTitle(task.title);
    setCategoryId(String(task.categoryId));
    setEstimate(task.estimateMin === null ? "" : String(task.estimateMin));
    setError(null);
    setConfirmingDelete(false);
    setEditing(false);
  }

  async function save() {
    setPending(true);
    setError(null);
    try {
      const result = await updateTask({
        id: task.id,
        title,
        categoryId: Number(categoryId),
        estimateMin: estimate.trim() === "" ? null : Number(estimate),
      });
      // 重複タイトルなどはサーバが理由を返すので、入力を残したまま見せる
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
    } catch {
      setError("タスクを変更できませんでした。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      const result = await deleteTask(task.id);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // 成功すると行そのものが一覧から消えるので、ここで閉じる操作は要らない
    } catch {
      setError("タスクを削除できませんでした。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  if (editing) {
    return (
      <li className="bg-card ring-primary/40 rounded-3xl p-5 shadow-sm ring-2">
        <form
          action={save}
          className="space-y-3"
          onKeyDown={(event) => {
            if (event.key === "Escape") cancelEdit();
          }}
        >
          <input
            autoFocus
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="タスク名"
            className="border-input bg-background h-12 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-current/20"
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="text-muted-foreground text-sm" htmlFor={`task-category-${task.id}`}>
              カテゴリ
            </label>
            <select
              id={`task-category-${task.id}`}
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
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
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              placeholder="任意"
              className="border-input bg-background h-11 w-24 rounded-xl border px-3 text-sm tabular-nums"
            />
            <span className="text-muted-foreground text-sm">分</span>

            <span className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={cancelEdit}
                className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={pending}
                className="bg-primary focus-visible:ring-primary rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
              >
                {pending ? "保存中…" : "保存"}
              </button>
            </span>
          </div>

          {error && <p className="text-live text-sm font-bold">{error}</p>}
        </form>

        <div className="border-border mt-4 border-t pt-4">
          {confirmingDelete ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-muted-foreground flex-1 text-sm">
                {hasRecords
                  ? "このタスクを一覧から隠します。記録した時間は分析に残ります。"
                  : "記録が1件もないので、このタスクを完全に削除します。"}
              </p>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2 text-sm font-bold"
              >
                やめる
              </button>
              <button
                type="button"
                onClick={remove}
                disabled={pending}
                className="bg-live focus-visible:ring-live rounded-full px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
              >
                {hasRecords ? "隠す" : "削除する"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
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

        {/* 状態と最終作業日は別々に出す。計測中だけ状態が読めなくなるのを避けるため */}
        {!done && (
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
          <button
            type="button"
            onClick={() => setEditing(true)}
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
