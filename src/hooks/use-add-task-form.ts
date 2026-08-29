"use client";

import { useState } from "react";
import { useActionState } from "@/hooks/use-action-state";
import { createTaskOnly } from "@/server/actions/timer";

export type UseAddTaskForm = {
  open: boolean;
  openForm: () => void;
  closeForm: () => void;
  title: string;
  setTitle: (value: string) => void;
  categoryId: string;
  setCategoryId: (value: string) => void;
  estimate: string;
  setEstimate: (value: string) => void;
  submit: () => Promise<void>;
  pending: boolean;
  error: string | null;
};

/**
 * タスク追加フォームのふるまい。
 *
 * 追加してもフォームを閉じない。まとめて登録したいことが多いので、
 * 名前と見積もりを消して次を打てるようにしている。カテゴリだけは残す
 * （続けて足すタスクは同じ分類になりやすいが、規模はそれぞれ違う）。
 *
 * 入力欄への再フォーカスは onAdded で呼び出し側に任せる。
 * どの DOM 要素に焦点を戻すかは画面の都合で、ここが決めることではない。
 */
export function useAddTaskForm(categories: { id: number }[], onAdded?: () => void): UseAddTaskForm {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState(String(categories[0]?.id ?? ""));
  const [estimate, setEstimate] = useState("");
  const { pending, error, run, clearError } = useActionState();

  /** 入力を直したらエラーを消す。直したのに古い指摘が残っていると紛らわしい */
  function edit(setter: (value: string) => void) {
    return (value: string) => {
      clearError();
      setter(value);
    };
  }

  return {
    open,
    openForm: () => setOpen(true),
    closeForm: () => setOpen(false),

    title,
    setTitle: edit(setTitle),
    categoryId,
    setCategoryId: edit(setCategoryId),
    estimate,
    setEstimate: edit(setEstimate),

    submit: async () => {
      const trimmed = title.trim();
      const ok = await run(
        () =>
          trimmed === ""
            ? Promise.resolve({ ok: false as const, message: "タスク名を入力してください" })
            : createTaskOnly({
                title: trimmed,
                categoryId: Number(categoryId),
                estimateMin: estimate === "" ? null : Number(estimate),
              }),
        "タスクを追加できませんでした。もう一度お試しください。",
      );
      if (!ok) return;

      setTitle("");
      setEstimate("");
      onAdded?.();
    },

    pending,
    error,
  };
}
