"use client";

import { useRef } from "react";

import { useAddTaskForm } from "@/hooks/use-add-task-form";

type Props = {
  categories: { id: number; name: string; color: string }[];
};

/**
 * タスク一覧の上に置く追加フォーム。作るだけで計測は始めない
 * （計測の開始は各行の「開始」で明示的に行う）。
 */
export function AddTaskForm({ categories }: Props) {
  const titleRef = useRef<HTMLInputElement>(null);
  // 続けて登録できるよう、追加できたら名前の欄に戻す
  const form = useAddTaskForm(categories, () => titleRef.current?.focus());

  if (!form.open) {
    return (
      <button
        type="button"
        onClick={form.openForm}
        className="bg-card hover:bg-accent focus-visible:ring-primary flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-4 text-base font-bold shadow-sm ring-1 ring-black/5 transition focus-visible:ring-4 focus-visible:outline-none dark:ring-white/5"
      >
        <span aria-hidden className="text-primary text-xl leading-none">
          ＋
        </span>
        タスクを追加
      </button>
    );
  }

  return (
    <div className="bg-card rounded-3xl p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <form
        action={form.submit}
        className="space-y-3"
        onKeyDown={(event) => {
          if (event.key === "Escape") form.closeForm();
        }}
      >
        <input
          ref={titleRef}
          autoFocus
          value={form.title}
          onChange={(event) => form.setTitle(event.target.value)}
          placeholder="タスク名"
          aria-label="タスク名"
          className="border-input bg-background h-12 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-current/20"
        />

        <div className="flex flex-wrap items-center gap-3">
          <label className="text-muted-foreground text-sm" htmlFor="add-task-category">
            カテゴリ
          </label>
          <select
            id="add-task-category"
            value={form.categoryId}
            onChange={(event) => form.setCategoryId(event.target.value)}
            className="border-input bg-background h-11 rounded-xl border px-3 text-sm"
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>

          <label className="text-muted-foreground ml-2 text-sm" htmlFor="add-task-estimate">
            見積もり
          </label>
          <input
            id="add-task-estimate"
            type="number"
            min={1}
            value={form.estimate}
            onChange={(event) => form.setEstimate(event.target.value)}
            placeholder="任意"
            className="border-input bg-background h-11 w-24 rounded-xl border px-3 text-sm tabular-nums"
          />
          <span className="text-muted-foreground text-sm">分</span>

          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={form.closeForm}
              className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={form.pending}
              className="bg-primary focus-visible:ring-primary rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
            >
              {form.pending ? "追加中…" : "追加する"}
            </button>
          </span>
        </div>

        {form.error && <p className="text-live text-sm font-bold">{form.error}</p>}
      </form>
    </div>
  );
}
