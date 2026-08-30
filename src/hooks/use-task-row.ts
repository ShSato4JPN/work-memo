"use client";

import { useState } from "react";

import { useActionState } from "@/hooks/use-action-state";
import { useElapsedSeconds } from "@/hooks/use-elapsed-seconds";
import { taskProgress, type TaskProgress } from "@/lib/task-progress";
import { deleteTask, updateTask } from "@/server/actions/task";
import type { TaskListItem } from "@/server/queries/tasks";

export type TaskRowEditor = {
  title: string;
  setTitle: (value: string) => void;
  categoryId: string;
  setCategoryId: (value: string) => void;
  estimate: string;
  setEstimate: (value: string) => void;
  save: () => Promise<void>;
};

export type UseTaskRow = {
  progress: TaskProgress;
  isRunning: boolean;
  isDone: boolean;
  /**
   * 記録が1件でもあるか。削除したときに一覧から隠すだけで済ませるか、
   * 完全に消してよいかの分かれ目になる。
   */
  hasRecords: boolean;
  editing: boolean;
  openEditor: () => void;
  cancelEdit: () => void;
  confirmingDelete: boolean;
  setConfirmingDelete: (value: boolean) => void;
  remove: () => Promise<void>;
  editor: TaskRowEditor;
  pending: boolean;
  error: string | null;
};

/**
 * タスク1行のふるまい。計測中の経過、見積もりとの比較、編集フォーム、削除確認をまとめる。
 *
 * 表示に必要な値はすべてここから出す。コンポーネント側で計算すると、
 * 同じ数字の出し方が行の見た目ごとにばらけるため。
 */
export function useTaskRow(task: TaskListItem): UseTaskRow {
  const startedAtMs = task.runningSince?.getTime() ?? null;
  const sessionSeconds = useElapsedSeconds(startedAtMs);

  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [title, setTitle] = useState(task.title);
  const [categoryId, setCategoryId] = useState(String(task.categoryId));
  const [estimate, setEstimate] = useState(
    task.estimateMin === null ? "" : String(task.estimateMin),
  );
  const { pending, error, run, clearError } = useActionState();

  function reset() {
    // 編集前の値に戻す
    setTitle(task.title);
    setCategoryId(String(task.categoryId));
    setEstimate(task.estimateMin === null ? "" : String(task.estimateMin));
    clearError();
    setConfirmingDelete(false);
  }

  /** 入力を直したらエラーを消す。直したのに古い指摘が残っていると紛らわしい */
  function edit(setter: (value: string) => void) {
    return (value: string) => {
      clearError();
      setter(value);
    };
  }

  return {
    progress: taskProgress({
      finishedMinutes: task.finishedMin,
      sessionSeconds,
      estimateMinutes: task.estimateMin,
    }),
    isRunning: startedAtMs !== null,
    isDone: task.status === "done",
    hasRecords: task.lastWorkedAt !== null,

    editing,
    openEditor: () => setEditing(true),
    cancelEdit: () => {
      reset();
      setEditing(false);
    },

    confirmingDelete,
    setConfirmingDelete,
    remove: async () => {
      // 成功すると行そのものが一覧から消えるので、閉じる操作は要らない
      await run(
        () => deleteTask(task.id),
        "タスクを削除できませんでした。もう一度お試しください。",
      );
    },

    editor: {
      title,
      setTitle: edit(setTitle),
      categoryId,
      setCategoryId: edit(setCategoryId),
      estimate,
      setEstimate: edit(setEstimate),
      save: async () => {
        const ok = await run(
          () =>
            updateTask({
              id: task.id,
              title,
              categoryId: Number(categoryId),
              estimateMin: estimate.trim() === "" ? null : Number(estimate),
            }),
          "タスクを変更できませんでした。もう一度お試しください。",
        );
        if (ok) setEditing(false);
      },
    },

    pending,
    error,
  };
}
